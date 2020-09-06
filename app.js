(() => {
  window.addEventListener("load", getLocation)

  let out;
  let coord;
  let closestSensor;

  function getLocation() {
    out = document.getElementById("aqi")
    navigator.geolocation.getCurrentPosition(located, unsupported)
  }

  function located(position) {
    coord = position.coords

    const url = "https://www.purpleair.com/data.json"

    window.fetch(url)
      .then(response => response.json())
      .then(findClosestSensor)
      .then(updateWithSensor)
      .catch(purpleError)
  }

  function updateWithSensor(sensor) {
    const url = `https://www.purpleair.com/json?show=${sensor.id}`

    window.fetch(url)
      .then(response => response.json())
      .then(updateAQI)
      .catch(purpleError)
  }

  function updateAQI(sensor) {
    const desc = document.getElementById("desc")
    const msg = document.getElementById("msg")
    const sensorInfo = document.getElementById("sensor")
    const body = document.querySelector("body")

    let pm25s = []
    for(const subsensor of sensor.results) {
      pm25s.push(parseFloat(subsensor["PM2_5Value"]))
    }
    const pm25 = (pm25s.reduce((a, b) => a + b)) / pm25s.length
    const aqi = aqanduAQIFromPM(pm25)

    const distance = Math.round(closestSensor.distance * 10) / 10
    const time = (new Date()).toLocaleTimeString()
    paLink = getPurpleAirLink()

    out.innerHTML = `AQI is ${aqi}`
    desc.innerHTML = getAQIDescription(aqi)
    msg.innerHTML = getAQIMessage(aqi)
    sensorInfo.innerHTML = `From <a href="${paLink}">a sensor ${distance}km away</a>  at ${time}`

    body.classList.remove(...body.classList)
    body.classList.add(getAQIClass(aqi))
    setTimeout(() => updateWithSensor(closestSensor), 30000);
  }

  function findClosestSensor(data) {
    let sensors = parsePurpleAirData(data)

    for(const sensor of sensors) {
      const distance = distanceBetweenCoords(coord, sensor)
      sensor.distance = distance
    }

    sensors.sort((a, b) => a.distance - b.distance)
    closestSensor = sensors[0]

    return closestSensor
  }

  function parsePurpleAirData(json) {
    let sensors = []
    let fields = []
    fields["indoor"] = json.fields.findIndex(e => e === "Type")
    fields["latitude"] = json.fields.findIndex(e => e === "Lat")
    fields["longitude"] = json.fields.findIndex(e => e === "Lon")
    fields["id"] = json.fields.findIndex(e => e === "ID")
    for(const sensor of json.data) {
      if(sensor[fields["indoor"]] === 0) {
        sensors.push({
          id: sensor[fields["id"]],
          latitude: sensor[fields["latitude"]],
          longitude: sensor[fields["longitude"]],
        })
      }
    }

    return sensors
  }

  // Adapted from https://stackoverflow.com/a/21623206 because I am a hack
  function distanceBetweenCoords(coord1, coord2) {
    const p = Math.PI / 180
    var a = 0.5 - Math.cos((coord2.latitude - coord1.latitude) * p)/2 +
            Math.cos(coord1.latitude * p) * Math.cos(coord2.latitude * p) *
            (1 - Math.cos((coord2.longitude - coord1.longitude) * p))/2

    return 12742 * Math.asin(Math.sqrt(a))
  }

  function getPurpleAirLink() {
    return `https://www.purpleair.com/map?opt=1/i/mAQI/a10/cC4&select=${closestSensor.id}#14/${coord.latitude}/${coord.longitude}`
  }

  function aqanduAQIFromPM(pm) {
    return aqiFromPM(0.778 * pm + 2.65)
  }

  function aqiFromPM(pm) {
    if (isNaN(pm)) return "-";
    if (pm == undefined) return "-";
    if (pm < 0) return pm;
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
    var a = (Ih - Il);
    var b = (BPh - BPl);
    var c = (Cp - BPl);
    return Math.round((a/b) * c + Il);
  }

  function getAQIClass(aqi) {
    return getAQIDescription(aqi).toLowerCase().replace(/ /g, "-")
  }

  function getAQIDescription(aqi) {
    if (aqi >= 401) {
      return 'Very Hazardous';
    } else if (aqi >= 301) {
      return 'Hazardous';
    } else if (aqi >= 201) {
      return 'Very Unhealthy';
    } else if (aqi >= 151) {
      return 'Unhealthy';
    } else if (aqi >= 101) {
      return 'Unhealthy for Sensitive Groups';
    } else if (aqi >= 51) {
      return 'Moderate';
    } else if (aqi >= 0) {
      return 'Good';
    } else {
      return undefined;
    }
  }

  function getAQIMessage(aqi) {
    if (aqi >= 401) {
      return 'Health alert: everyone may experience more serious health effects';
    } else if (aqi >= 301) {
      return 'Health alert: everyone may experience more serious health effects';
    } else if (aqi >= 201) {
      return 'Health warnings of emergency conditions. The entire population is more likely to be affected. ';
    } else if (aqi >= 151) {
      return 'Everyone may begin to experience health effects; members of sensitive groups may experience more serious health effects.';
    } else if (aqi >= 101) {
      return 'Members of sensitive groups may experience health effects. The general public is not likely to be affected.';
    } else if (aqi >= 51) {
      return 'Air quality is acceptable; however, for some pollutants there may be a moderate health concern for a very small number of people who are unusually sensitive to air pollution.';
    } else if (aqi >= 0) {
      return 'Air quality is considered satisfactory, and air pollution poses little or no risk';
    } else {
      return undefined;
    }
  }

  function unsupported() {
    out.innerHTML = "Couldn't find ya or you got an unsupported browser, chief"
  }

  function purpleError(error) {
    console.error("Purple Air Error: ", error)
    out.innerHTML = "idk how purple air evens, m8"
  }
})();
