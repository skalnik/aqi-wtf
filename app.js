(() => {
  window.addEventListener("load", getLocation)
  let out;

  function getLocation() {
    out = document.getElementById("output")
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(updatePosition)
    } else {
      out.innerHTML = "Couldn't find ya"
    }
  }

  function updatePosition(position) {
    const coord = position.coords
    const roundedCoords = {
      latitude: roundHundreth(coord.latitude),
      longitude: roundHundreth(coord.longitude)
    }

    out.innerHTML = "Latitude: " + roundedCoords.latitude + " Longitude: " + roundedCoords.longitude
  }

  function roundHundreth(number) {
    return Math.round(number * 100)/100
  }
})();
