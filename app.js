(() => {
  window.addEventListener("load", getLocation)

  const url = "https://www.purpleair.com/data.json"
  let out;
  let coord;

  function getLocation() {
    out = document.getElementById("output")
    navigator.geolocation.getCurrentPosition(located, unsupported)
  }

  function located(position) {
    coord = position.coords
    const nwCoord = {
      latitude: coord.latitude + 0.01,
      longitude: coord.longitude + 0.15
    }
    const seCoord = {
      latitude: coord.latitude - 0.01,
      longitude: coord.longitude - 0.15
    }

    out.innerHTML = `nw: [${nwCoord.latitude}, ${nwCoord.longitude}] <br /> se: [${seCoord.latitude}, ${seCoord.longitude}]`


    window.fetch(url)
      .then(response => response.json())
      .then(findClosestSensor)
      .then(updateWithSensor)
      .catch(purpleError)
  }

  function updateWithSensor(sensor) {
    
  }

  function findClosestSensor(data) {
    console.log(data)
    let sensors = parsePurpleAirData(data)

    for(const sensor of sensors) {
      const distance = distanceBetweenCoords(coord, sensor)
      sensor.distance = distance
    }

    sensors.sort((a, b) => a.distance - b.distance)

    out.innerHTML = `Your closest sensor is ${sensors[0].id}<br />It is ${sensors[0].distance}km away`

    return sensors[0]
  }

  function parsePurpleAirData(json) {
    let sensors = []
    let fields = []
    fields["indoor"] = json.fields.findIndex(e => e === "Type")
    fields["latitude"] = json.fields.findIndex(e => e === "Lat")
    fields["longitude"] = json.fields.findIndex(e => e === "Lon")
    fields["id"] = json.fields.findIndex(e => e === "ID")
    console.log("Alright, computed fields", fields)
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

  function unsupported() {
    out.innerHTML = "Couldn't find ya or you got an unsupported browser, chief"
  }

  function purpleError(error) {
    console.error("Purple Air Error: ", error)
    out.innerHTML = "idk how purple air evens, m8"
  }
})();
