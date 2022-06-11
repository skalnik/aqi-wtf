(() => {
  window.addEventListener("load", onStart);

  let coord;
  let closestSensor;

  function onStart() {
    document.getElementById("powerwash").onclick = clearStorage;
    getLocation();

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js");
    }
  }

  function getLocation() {
    announceState("Finding you");
    // If we don't have a location yet, then this is the first time we're trying
    // and we should explain ourselves
    if (coord === undefined) {
      explainPermissionsRequest();
    }
    navigator.geolocation.getCurrentPosition(located, unsupported);
  }

  function located(position) {
    coord = position.coords;
    clearPermissionsRequest();
    announceState("Finding nearby sensors");
    loadSensorsFromCacheAndShowAQI();
  }

  function loadSensorsFromCacheAndShowAQI() {
    try {
      const cachedSensors = window.localStorage.getItem("sensors");
      sensor_data = JSON.parse(cachedSensors);
      if (sensor_data == null) {
        throw "Sensor data not cached";
      }
      if (sensor_data.version !== 1) {
        throw "Sensor data is the wrong version";
      }
      if (Date.now() > sensor_data.timestamp + 86400 * 1000) {
        throw "Sensor data is more than a day old";
      }
      sensor = findClosestSensor(sensor_data.data);
      updateWithSensor(sensor);
    } catch (exception) {
      console.log("Exception while reading cached sensor data");
      console.log(exception);
      clearStorage();
      fetchSensorListAndShowAQI();
    }
  }

  function clearStorage() {
    window.localStorage.removeItem("sensors");
    console.log("Cleared stored sensor list");
  }

  function fetchSensorListAndShowAQI() {
    const url =
      "https://api.purpleair.com/v1/sensors?api_key=AA055D5D-E333-11EC-8561-42010A800005&fields=longitude,latitude&location_type=0&max_age=300"

    window
      .fetch(url)
      .then((response) => response.json())
      .then((response) => {
        if (response.code && response.code >= 400 && response.message) {
          throw new Error(response.message);
        }
        return response;
      })
      .then(parsePurpleAirData)
      .then(findClosestSensor)
      .then(updateWithSensor)
      .catch(purpleError);
  }

  function updateWithSensor(sensor) {
    announceState("Getting sensor data");
    const url = `https://api.purpleair.com/v1/sensors/${sensor.id}?api_key=AA055D5D-E333-11EC-8561-42010A800005&fields=pm2.5_10minute_a,pm2.5_10minute_b,humidity`

    window
      .fetch(url)
      .then((response) => response.json())
      .then(updateAQI)
      .catch(purpleError);
  }

  function updateAQI(sensor) {
    sensor = sensor.sensor;
    announceState("Calculating AQI");

    const humidity = sensor.humidity;
    let pm25s = []

    if (sensor.stats_a["pm2.5_10minute"] !== 0.0) {
      pm25s.push(sensor.stats_a["pm2.5_10minute"])
    }

    if (sensor.stats_b["pm2.5_10minute"] !== 0.0) {
      pm25s.push(sensor.stats_b["pm2.5_10minute"])
    }

    const pm25 = pm25s.reduce((a, b) => a + b) / pm25s.length;
    const aqi = epaAQIFromPMandHumidity(pm25, humidity);

    const distance = Math.round(closestSensor.distance * 10) / 10;
    const time = new Date().toLocaleTimeString();
    const paLink = getPurpleAirLink();
    const stateMsg = `and <a href="${paLink}">a sensor ${distance}km away</a> at ${time}`;

    announce(aqi, "", stateMsg);

    // We want to sent the body state after announcing the AQI
    document.body.classList.add(getAQIClass(aqi), "aqi-result");

    // When the animation ends, make sure the top tab/tray color matches the bg
    let tc = document.head.querySelector('meta[name="theme-color"]');
    if (tc) {
      document.body.ontransitionend = function () {
        tc.setAttribute(
          "content",
          window.getComputedStyle(document.body).backgroundColor
        );
      };
    }

    setTimeout(() => getLocation(), 60000);
  }

  function bustedSensor(sensor) {
    const pValues = [
      "p_0_3_um",
      "p_0_5_um",
      "p_1_0_um",
      "p_2_5_um",
      "p_5_0_um",
      "p_10_0_um",
      "pm1_0_cf_1",
      "pm2_5_cf_1",
      "pm10_0_cf_1",
      "pm1_0_atm",
      "pm2_5_atm",
      "pm10_0_atm",
    ];

    for (const pValue of pValues) {
      if (sensor[pValue] !== "0.0") {
        return false;
      }
    }

    return true;
  }

  function explainPermissionsRequest() {
    document.body.classList.add("requesting-location");
  }

  function clearPermissionsRequest() {
    document.body.classList.remove("requesting-location");
  }

  function announce(headMsg, descMsg = "", stateMsg = "") {
    const head = document.getElementById("aqi");
    const desc = document.getElementById("desc");
    const state = document.getElementById("state");

    // We want to clear the body state on any announce
    document.body.classList.remove(...document.body.classList);

    head.innerHTML = headMsg;
    desc.innerHTML = descMsg;
    state.innerHTML = stateMsg;
  }

  function announceError(errorMsg, descMsg = "") {
    if (closestSensor !== undefined && closestSensor !== null && closestSensor.id !== null) {
      const paLink = getPurpleAirLink();
      callToAction = `<a href='#' onclick='location.reload()'>Reload?</a> Or <a href="${paLink}">try PurpleAir's map</a>.`;
    } else {
      callToAction =
        "You might want to try <a href='https://www.purpleair.com/map?opt=1/i/mAQI/a0/cC1#1/25/-30'>PurpleAir's map</a>.";
    }

    announce(errorMsg, descMsg, callToAction);
  }

  function announceState(stateMsg) {
    // If we have something in state already, it means we've previously loaded
    // some content and don't want to blow away the top level AQI state until
    // we have something interesting to report
    const state = document.getElementById("state");
    if (state.innerHTML !== "") {
      state.innerHTML = stateMsg;
    } else {
      // If state is empty, we have not yet given the breather an AQI reading, so
      // state is important enough to shove up top in the H1
      announce(stateMsg);
    }
  }

  function findClosestSensor(sensors) {
    for (const sensor of sensors) {
      const distance = distanceBetweenCoords(coord, sensor);
      sensor.distance = distance;
    }

    sensors.sort((a, b) => a.distance - b.distance);
    closestSensor = sensors[0];

    return closestSensor;
  }

  function parsePurpleAirData(json) {
    let sensors = [];
    let fields = [];
    fields["latitude"] = json.fields.findIndex((e) => e === "latitude");
    fields["longitude"] = json.fields.findIndex((e) => e === "longitude");
    fields["sensor_index"] = json.fields.findIndex((e) => e === "sensor_index");
    for (const sensor of json.data) {
      sensors.push({
        id: sensor[fields["sensor_index"]],
        latitude: sensor[fields["latitude"]],
        longitude: sensor[fields["longitude"]],
      });
    }
    window.localStorage.setItem(
      "sensors",
      JSON.stringify({ version: 1, timestamp: Date.now(), data: sensors })
    );
    return sensors;
  }

  // Adapted from https://stackoverflow.com/a/21623206 because I am a hack
  function distanceBetweenCoords(coord1, coord2) {
    const p = Math.PI / 180;
    var a =
      0.5 -
      Math.cos((coord2.latitude - coord1.latitude) * p) / 2 +
      (Math.cos(coord1.latitude * p) *
        Math.cos(coord2.latitude * p) *
        (1 - Math.cos((coord2.longitude - coord1.longitude) * p))) /
        2;
    // 12742 is the diameter of earth in km
    return 12742 * Math.asin(Math.sqrt(a));
  }

  function getPurpleAirLink() {
    return `https://www.purpleair.com/map?opt=1/i/mAQI/a0/cC5&select=${closestSensor.id}#14/${coord.latitude}/${coord.longitude}`;
  }

  function aqanduAQIFromPM(pm) {
    return aqiFromPM(0.778 * pm + 2.65);
  }

  // From https://www.epa.gov/sites/default/files/2021-05/documents/toolsresourceswebinar_purpleairsmoke_210519b.pdf final slide
  function epaAQIFromPMandHumidity(pm, humidity) {
    if (pm < 50) {
      return aqiFromPM(0.52 * pm - 0.086 * humidity + 5.75);
    } else if (pm < 229) {
      return aqiFromPM(0.786 * pm - 0.086 * humidity + 5.75);
    } else {
      return aqiFromPM(
        0.69 * pm + 8.84 * Math.pow(10, -4) * Math.pow(pm, 2) + 2.97
      );
    }
  }

  function aqiFromPM(pm) {
    if (isNaN(pm)) return "-";
    if (pm == undefined) return "-";
    if (pm < 0) return 0;
    if (pm > 1000) return "-";

    if (pm > 350.5) {
      return calcAQI(pm, 500, 401, 500, 350.5);
    } else if (pm > 250.5) {
      return calcAQI(pm, 400, 301, 350.4, 250.5);
    } else if (pm > 150.5) {
      return calcAQI(pm, 300, 201, 250.4, 150.5);
    } else if (pm > 55.5) {
      return calcAQI(pm, 200, 151, 150.4, 55.5);
    } else if (pm > 35.5) {
      return calcAQI(pm, 150, 101, 55.4, 35.5);
    } else if (pm > 12.1) {
      return calcAQI(pm, 100, 51, 35.4, 12.1);
    } else if (pm >= 0) {
      return calcAQI(pm, 50, 0, 12, 0);
    } else {
      return undefined;
    }
  }

  function calcAQI(Cp, Ih, Il, BPh, BPl) {
    // The AQI equation https://forum.airnowtech.org/t/the-aqi-equation/169
    var a = Ih - Il;
    var b = BPh - BPl;
    var c = Cp - BPl;
    return Math.round((a / b) * c + Il);
  }

  function getAQIClass(aqi) {
    if (aqi >= 401) {
      return "very-hazardous";
    } else if (aqi >= 301) {
      return "hazardous";
    } else if (aqi >= 201) {
      return "very-unhealthy";
    } else if (aqi >= 151) {
      return "unhealthy";
    } else if (aqi >= 101) {
      return "unhealthy-for-sensitive-groups";
    } else if (aqi >= 51) {
      return "moderate";
    } else if (aqi >= 0) {
      return "good";
    } else {
      return undefined;
    }
  }

  function unsupported() {
    clearPermissionsRequest();
    announceError(
      "Scooby-Doo, Where Are You!",
      "We need your browser location to find the nearest PurpleAir sensor. This information never leaves your device. It's not sent to a server."
    );
  }

  function purpleError(error) {
    console.error("Purple Air Error: ", error);
    announceError("idk how purple air evens, m8", error);
  }
})();
