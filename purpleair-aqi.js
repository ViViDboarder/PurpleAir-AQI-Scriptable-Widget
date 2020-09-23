// widget code by Jason Snell <jsnell@sixcolors.com>
// based on code by Matt Silverlock
// gradient routine contributed by Rob Silverii
// pretty formatting and functioning by Adam Lickel

const API_URL = "https://www.purpleair.com/json?show=";

// Find a nearby PurpleAir sensor ID via https://fire.airnow.gov/
// Click a sensor near your location: the ID is the trailing integers
// https://www.purpleair.com/json has all sensors by location & ID.
let SENSOR_ID = args.widgetParameter || "34663";

// Fetch content from PurpleAir
async function getSensorData(url, id) {
  let req = new Request(`${url}${id}`);
  let json = await req.loadJSON();

  return {
    "val": json.results[0].Stats,
    "adj1": json.results[0].pm2_5_cf_1,
    "adj2": json.results[1].pm2_5_cf_1,
    "ts": json.results[0].LastSeen,
    "hum": json.results[0].humidity,
    "loc": json.results[0].Label,
    "lat": json.results[0].Lat,
    "lon": json.results[0].Lon
  };
}

// Widget attributes: AQI level threshold, text label, gradient start and end colors, text color
const levelAttributes = [
  {
    threshold: 300,
    label: "Hazardous",
    lightColors: {
      startColor: "9e2043",
      endColor: "7e0023",
      textColor: "ffffff",
    },
    darkColors: {
      startColor: "9e2043",
      endColor: "7e0023",
      textColor: "ffffff",
    },
    textSize: "20",
  },
  {
    threshold: 200,
    label: "Very Unhealthy",
    lightColors: {
      startColor: "8f3f97",
      endColor: "6f1f77",
      textColor: "ffffff",
    },
    darkColors: {
      startColor: "8f3f97",
      endColor: "6f1f77",
      textColor: "ffffff",
    },
    textSize: 15,
 },
  {
    threshold: 150,
    label: "Unhealthy",
    lightColors: {
      startColor: "FF3D3D",
      endColor: "D60000",
      textColor: "000000",
    },
    darkColors: {
      startColor: "FF3D3D",
      endColor: "D60000",
      textColor: "000000",
    },
    textSize: 20,
  },
  {
    threshold: 100,
    label: "Unhealthy (S.G.)",
    lightColors: {
      startColor: "FFA63D",
      endColor: "D67200",
      textColor: "000000",
    },
    darkColors: {
      startColor: "FFA63D",
      endColor: "D67200",
      textColor: "000000",
    },
    textSize: 15,
  },
  {
    threshold: 50,
    label: "Moderate",
    lightColors: {
      startColor: "ffff00",
      endColor: "cccc00",
      textColor: "000000",
    },
    darkColors: {
      startColor: "ffff00",
      endColor: "cccc00",
      textColor: "000000",
    },
    textSize: 20,
  },
  {
    threshold: 0,
    label: "Good",
    lightColors: {
      startColor: "ffffff",
      endColor: "ffffff",
      textColor: "00e400",
    },
    darkColors: {
      startColor: "000000",
      endColor: "000000",
      textColor: "00e400",
    },
    textSize: 20,
  },
];

// Get level attributes for AQI
function getLevelAttributes(level, attributes) {
  let applicableAttributes = attributes
    .filter((c) => level > c.threshold)
    .sort((a, b) => b.threshold - a.threshold);
  return applicableAttributes[0];
}

// Function to get the EPA adjusted PPM
function computePM(data) {
  let adj1 = parseInt(data.adj1, 10);
  let adj2 = parseInt(data.adj2, 10);
  let hum = parseInt(data.hum, 10);
  let dataAverage = ((adj1 + adj2)/2);

  // Apply EPA draft adjustment for wood smoke and PurpleAir
  // from https://cfpub.epa.gov/si/si_public_record_report.cfm?dirEntryId=349513&Lab=CEMM&simplesearch=0&showcriteria=2&sortby=pubDate&timstype=&datebeginpublishedpresented=08/25/2018

  return ((0.52 * dataAverage) - (.085 * hum) + 5.71);
}

// Function to get AQI number from PPM reading
function aqiFromPM(pm) {
  if (pm > 350.5) {
    return calcAQI(pm, 500.0, 401.0, 500.0, 350.5);
  } else if (pm > 250.5) {
    return calcAQI(pm, 400.0, 301.0, 350.4, 250.5);
  } else if (pm > 150.5) {
    return calcAQI(pm, 300.0, 201.0, 250.4, 150.5);
  } else if (pm > 55.5) {
    return calcAQI(pm, 200.0, 151.0, 150.4, 55.5);
  } else if (pm > 35.5) {
    return calcAQI(pm, 150.0, 101.0, 55.4, 35.5);
  } else if (pm > 12.1) {
    return calcAQI(pm, 100.0, 51.0, 35.4, 12.1);
  } else if (pm >= 0.0) {
    return calcAQI(pm, 50.0, 0.0, 12.0, 0.0);
  } else {
    return "-";
  }
}

// Function that actually calculates the AQI number
function calcAQI(Cp, Ih, Il, BPh, BPl) {
  let a = (Ih - Il);
  let b = (BPh - BPl);
  let c = (Cp - BPl);
  return Math.round((a/b) * c + Il);
}

// Calculates the AQI level based on
// https://cfpub.epa.gov/airnow/index.cfm?action=aqibasics.aqi#unh
function calculateLevel(aqi) {
  let res = {
    level: "OK",
    label: "fine",
    startColor: "white",
    endColor: "white",
    textSize: 10,
  };

  let level = parseInt(aqi, 10) || 0;

  // Set attributes
  res = getLevelAttributes(level, levelAttributes);
  // Set level
  res.level = level;
  return res;
}

// Function to get the AQI trends suffix
function trendsFromStats(stats) {
  let partLive = parseInt(stats.v1, 10);
  let partTime = parseInt(stats.v2, 10);
  let partDelta = partTime - partLive;

  if (partDelta > 5) {
    theTrend = " Improving";
  } else if (partDelta < -5) {
    theTrend = " Worsening";
  } else {
    theTrend = "";
  }
  return theTrend;
}

async function run() {
  let wg = new ListWidget();
  wg.setPadding(20, 15, 10, 10);

  try {
    console.log(`Using sensor ID: ${SENSOR_ID}`);

    let data = await getSensorData(API_URL, SENSOR_ID);
    let stats = JSON.parse(data.val);
    console.log(stats);

    let theTrend = trendsFromStats(stats);
    console.log(theTrend);

    let epaPM = computePM(data);
    console.log(epaPM);

    let aqi = aqiFromPM(epaPM);
    let level = calculateLevel(aqi);
    let aqiText = aqi.toString();
    console.log(aqi);
    console.log(level.level);
    
    var themeColors = null;
    if (Device.isUsingDarkAppearance()) {
      themeColors = level.darkColors;
    } else {
      themeColors = level.lightColors;
    }
    let startColor = new Color(themeColors.startColor);
    let endColor = new Color(themeColors.endColor);
    let textColor = new Color(themeColors.textColor);
    let gradient = new LinearGradient();
    gradient.colors = [startColor, endColor];
    gradient.locations = [0.0, 1];
    console.log(gradient);

    wg.backgroundGradient = gradient;

    let header = wg.addText("AQI" + theTrend);
    header.textColor = textColor;
    header.font = Font.regularSystemFont(15);

    let content = wg.addText(aqiText);
    content.textColor = textColor;
    content.font = Font.semiboldRoundedSystemFont(30);

    let wordLevel = wg.addText(level.label);
    wordLevel.textColor = textColor;
    wordLevel.font = Font.boldSystemFont(level.textSize);

    wg.addSpacer(10);

    let location = wg.addText(data.loc);
    location.textColor = textColor;
    location.font = Font.mediumSystemFont(12);

    let updatedAt = new Date(data.ts * 1000)
      .toLocaleTimeString([], { hour: '2-digit', minute: '2-digit'});
    let ts = wg.addText(`Updated ${updatedAt}`);
    ts.textColor = textColor;
    ts.font = Font.lightSystemFont(10);

    wg.addSpacer(10);

    let purpleMap = 'https://www.purpleair.com/map?opt=1/i/mAQI/a10/cC0&select=' + SENSOR_ID + '#14/' + data.lat + '/' + data.lon;
    wg.url = purpleMap;
  } catch (e) {
    console.log(e);

    let err = wg.addText(`${e}`);
    err.textColor = Color.red();
    err.textOpacity = 30;
    err.font = Font.regularSystemFont(10);
  }

  if (config.runsInApp) {
    wg.presentSmall();
  }

  Script.setWidget(wg);
  Script.complete();
}

await run();
