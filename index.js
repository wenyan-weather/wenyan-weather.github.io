'use strict';

import { fetchWeatherApi } from "https://esm.sh/openmeteo";
import * as cn from "https://unpkg.com/chinese-numbering@1.x/bundle/es.js";

const HOURLY_WEATHER_ID = 'hourly';

const OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast";
const FORECAST_NUM_DAYS = 10;

const DEGREE_SYMBOL = "度";
const FEELS_LIKE = "體感";
const SUNRISE = "日出";
const SUNSET = "日入";

const YEAR = "年";
const MONTH = "月";
const DAY = "日";
const KE = "刻";

const DIRECTIONS = ["北", "東北", "東", "東南", "南", "西南", "西", "西北"];
const DEGREES_IN_CIRCLE = 360;
const DIR_INTERVAL = DEGREES_IN_CIRCLE / DIRECTIONS.length;

const LONG_SPACE = "　";

const WEATHER_CODES = {
	"0": "晴",
	"1": "微晴",
	"2": "微陰",
	"3": "陰",

	"45": "霧",
	"48": "霧凇",

	"51": "小霡霂",
	"53": "霡霂",
	"55": "大霢霂",
	"56": "小霢霂木冰",
	"57": "大霢霂木冰",

	"61": "小雨",
	"63": "雨",
	"65": "大雨",
	"66": "小雨木冰",
	"67": "大雨木冰",

	"71": "小雪",
	"73": "雪",
	"75": "大雪",

	"77": "霰",

	"80": "小雨乍灑乍止",
	"81": "雨乍灑乍止",
	"82": "大雨乍灑乍止",
	"85": "小雪乍灑乍止",
	"86": "大雪乍灑乍止",

	"95": "雷雨",
	"96": "雷小雹",
	"97": "大雷雨",
	"99": "雷大雹"
};

// This is needed bc the Lunar library outputs solar terms in simplified
const SOLAR_TERMS_TRADITIONAL = {
	"惊蛰": "驚蟄",
	"谷雨": "穀雨",
	"小满": "小滿",
	"芒种": "芒種",
	"处暑": "處暑"
};

const DAYS_OF_MONTH = {
	5: "初五",
	10: "初十",
	15: "望",
	20: "二十",
	25: "廿五"
};

const 天干順序 = "甲乙丙丁戊己庚辛壬癸";
const 地支順序 = "子丑寅卯辰巳午未申酉戌亥";
const DIGITS = "〇一二三四五六七八九";
const 曜日順序 = "日月火水木金土";
const 干支配數 = 60;

function setText(id, text) {
	document.getElementById(id).textContent = String(text);
}

function hanziNum(n) {
	return cn.numberToChinese(n).replace("零", "〇");
}

function shortHanziNum(n) {
	return cn.numberToChinese(n)
		.replace("零", "〇")
		.replace("二十", "廿")
		.replace("三十", "卅")
		.replace("四十", "卌");
}

function hanziDigits(n) {
	return [...String(n)]
		.map(d => DIGITS[d])
		.join('');
}

function temperatureText(temp) {
	return shortHanziNum(Math.round(temp)) + DEGREE_SYMBOL;
}

/**
 * Converts an hour number to the 12-hour system. For example, hour 0 is 子正 and hour 1 is 丑初. The hour number should be in the range 0-23 inclusive.
 */
function jiaziHour(hourNum) {
	let halfHourIdx = ((hourNum + 1) % 24) >> 1;
	return 地支順序[halfHourIdx] + "正初"[hourNum % 2];
}

function keFromMins(mins) {
	let ke = Math.floor(mins / 15);
	return ke == 0 ? "" : hanziNum(ke) + KE;
}

/**
 * Modulo operation, which works on negative numbers in a cyclic fashion.
 * 
 * For example, `mod(-5, 60)` returns 55.
 */
function mod(a, b) {
	return ((a % b) + b) % b
}

async function getWeather(lat, long) {
	const params = {
		latitude: lat,
		longitude: long,
		daily: ["temperature_2m_max", "temperature_2m_min", "weather_code", "sunrise", "sunset"],
		hourly: ["temperature_2m", "precipitation_probability", "precipitation", "rain", "wind_speed_10m", "wind_direction_10m", "wind_gusts_10m", "showers", "snowfall", "weather_code"],
		current: ["temperature_2m", "relative_humidity_2m", "apparent_temperature", "wind_speed_10m", "wind_direction_10m", "wind_gusts_10m", "precipitation", "rain", "showers", "snowfall", "weather_code"],
		timezone: "auto",
		past_hours: 0,
		forecast_hours: 24,
		past_days: 0,
		forecast_days: FORECAST_NUM_DAYS,
	};

	const responses = await fetchWeatherApi(OPEN_METEO_URL, params);
	// Process first location. Add a for-loop for multiple locations or weather models
	const res = responses[0];

	const utcOffsetSec = res.utcOffsetSeconds();

	const curr = res.current();
	const hourly = res.hourly();
	const daily = res.daily();

	// Note: The order of weather variables in the URL query and the indices below need to match!
	const weatherData = {
		current: {
			time: new Date((Number(curr.time()) + utcOffsetSec) * 1000),
			temperature_2m: curr.variables(0).value(),
			relative_humidity_2m: curr.variables(1).value(),
			apparent_temperature: curr.variables(2).value(),
			wind_speed_10m: curr.variables(3).value(),
			wind_direction_10m: curr.variables(4).value(),
			wind_gusts_10m: curr.variables(5).value(),
			precipitation: curr.variables(6).value(),
			rain: curr.variables(7).value(),
			showers: curr.variables(8).value(),
			snowfall: curr.variables(9).value(),
			weather_code: hourly.variables(10).value(),
		},
		hourly: {
			time: Array.from(
				{ length: (Number(hourly.timeEnd()) - Number(hourly.time())) / hourly.interval() }, 
				(_ , i) => new Date((Number(hourly.time()) + i * hourly.interval()) * 1000)
			),
			temperature_2m: hourly.variables(0).valuesArray(),
			precipitation_probability: hourly.variables(1).valuesArray(),
			precipitation: hourly.variables(2).valuesArray(),
			rain: hourly.variables(3).valuesArray(),
			wind_speed_10m: hourly.variables(4).valuesArray(),
			wind_direction_10m: hourly.variables(5).valuesArray(),
			wind_gusts_10m: hourly.variables(6).valuesArray(),
			showers: hourly.variables(7).valuesArray(),
			snowfall: hourly.variables(8).valuesArray(),
			weather_code: hourly.variables(9).valuesArray(),
		},
		daily: {
			time: Array.from(
				{ length: (Number(daily.timeEnd()) - Number(daily.time())) / daily.interval() }, 
				(_ , i) => new Date((Number(daily.time()) + i * daily.interval()) * 1000)
			),
			temperature_2m_max: daily.variables(0).valuesArray(),
			temperature_2m_min: daily.variables(1).valuesArray(),
			weather_code: daily.variables(2).valuesArray(),
			sunrise: [...Array(daily.variables(3).valuesInt64Length())].map(
				(_ , i) => new Date((Number(daily.variables(3).valuesInt64(i))) * 1000)
			),
			sunset: [...Array(daily.variables(4).valuesInt64Length())].map(
				(_ , i) => new Date((Number(daily.variables(4).valuesInt64(i))) * 1000)
			),
		},
	};

	return weatherData;
}

/**
 * A sexagenary cycle index.
 * 
 * The number passed to the constructor is zero-indexed. For example,
 * normally 辛酉 is 58, but my representation of 辛酉 in this class is
 * constructed by `new 干支(57)`, and `this.天干 === 7` as well as
 * `this.地支 === 9`. This is because the majority of operations do not
 * actually involve displaying the underlying numbers and so it is
 * easier to keep the number zero-indexed.
 * 
 * If the number is `< 0` or `>= 60`, the number will be clipped into
 * the correct range so that the conversion will give the correct result.
 * 
 * `toNumber()` returns whatever was passed into the constructor, so it will
 * be one off from what a human would expect.
 */
class 干支 {
	constructor(n) {
		let m = mod(n, 干支配數);
		this.天干 = m % 天干順序.length;
		this.地支 = m % 地支順序.length;
	}

	toNumber() {
		let tens = (this.天干 - this.地支) >> 1;
		if (tens < 0) {
			tens += 6;
		}
		return tens * 10 + this.天干;
	}

	toString() {
		return 天干順序[this.天干] + 地支順序[this.地支];
	}
}

function updateWeather(lat, long) {
	getWeather(lat, long).then(weather => {
		console.log(weather);

		/* Curr weather */

		let actTemp = Math.round(weather.current.temperature_2m);
		let feelTemp = Math.round(weather.current.apparent_temperature);
		let currTemp = temperatureText(actTemp) + (
			(actTemp === feelTemp)
				? ("")
				: (LONG_SPACE + FEELS_LIKE + temperatureText(feelTemp))
		);
		let adjustedDir = (weather.current.wind_direction_10m + DIR_INTERVAL) % DEGREES_IN_CIRCLE;
		let windDir = DIRECTIONS[Math.floor(adjustedDir / DIR_INTERVAL)];
		let windSpeed = `一小時${hanziNum(Math.round(weather.current.wind_speed_10m))}公里`;

		setText('curr-weather', WEATHER_CODES[weather.current.weather_code] + LONG_SPACE + currTemp);
		setText('wind-info', windDir + LONG_SPACE + windSpeed);

		/* Hourly weather */

		// Reset table
		let hourlyTable = document.getElementById('hourly');
		while (hourlyTable.childNodes.length > 2) {
			hourlyTable.removeChild(hourlyTable.lastChild);
		}

		// 3 sunrises/sunsets in 24 hrs is theoretically possible
		let sunrises = weather.daily.sunrise.slice(0, 3);
		let sunsets = weather.daily.sunset.slice(0, 3);

		// Set curr weather
		setText('curr-hour-weather', WEATHER_CODES[weather.current.weather_code]);
		setText('curr-hour-temp', temperatureText(actTemp));

		for(let i = 1; i < weather.hourly.time.length; ++i) {
			let date = weather.hourly.time[i];
			let sunriseSunsetText = "";

			if (
				sunrises.some((sunrise, i, _) => sunrise.getDay() == date.getDay()
				&& sunrise.getHours() == date.getHours())
			) {
				sunriseSunsetText = SUNRISE;
			} else if (
				sunsets.some((sunset, i, _) => sunset.getDay() == date.getDay()
				&& sunset.getHours() == date.getHours())
			) {
				sunriseSunsetText = SUNSET;
			}

			let newRow = document.createElement('tr');
			let sunriseSunsetEl = document.createElement('td');
			let headerEl = document.createElement('th');
			let weatherEl = document.createElement('td');
			let tempEl = document.createElement('td');

			sunriseSunsetEl.textContent = sunriseSunsetText;
			headerEl.textContent = jiaziHour(date.getHours());
			weatherEl.textContent = WEATHER_CODES[weather.hourly.weather_code[i]];
			tempEl.textContent = temperatureText(weather.hourly.temperature_2m[i]);
			tempEl.classList.add('left-align');
			newRow.appendChild(sunriseSunsetEl);
			newRow.appendChild(headerEl);
			newRow.appendChild(weatherEl);
			newRow.appendChild(tempEl);
			hourlyTable.appendChild(newRow);
		}

		/* Daily weather */

		// Reset table
		let dailyTable = document.getElementById('daily');
		while (dailyTable.childNodes.length > 2) {
			dailyTable.removeChild(dailyTable.lastChild);
		}

		// Set current weather
		let lunarDate = Lunar.fromDate(weather.current.time);
		let lunarDay = lunarDate.getDay();
		let jieQiSimplified = lunarDate.getJieQi();
		let jieQi = SOLAR_TERMS_TRADITIONAL[jieQiSimplified] ?? jieQiSimplified;
		let dayOfMonth =
			(lunarDay == 1)
			? lunarDate.getMonth() + MONTH
			: (DAYS_OF_MONTH[lunarDay] ?? "");
		console.log(dayOfMonth);

		setText('today-solar-term', jieQi ?? dayOfMonth);
		setText('today-weather', WEATHER_CODES[weather.daily.weather_code[0]]);
		setText('today-high', temperatureText(weather.daily.temperature_2m_max[0]));
		setText('today-low', temperatureText(weather.daily.temperature_2m_min[0]));

		for(let i = 1; i < weather.daily.time.length; ++i) {
			console.log("day " + String(i));
			let date = weather.daily.time[i];
			let lunarDate = Lunar.fromDate(date);
			let yaoriDay = 曜日順序[date.getDay()];
			let jiaziDay = lunarDate.getDayInGanZhi();

			let jieQiSimplified = lunarDate.getJieQi();
			let jieQi = SOLAR_TERMS_TRADITIONAL[jieQiSimplified] ?? jieQiSimplified;

			let newRow = document.createElement('tr');
			let jieqiEl = document.createElement('td');
			let headerEl = document.createElement('th');
			let weatherEl = document.createElement('td');
			let highEl = document.createElement('td');
			let lowEl = document.createElement('td');

			jieqiEl.textContent = jieQi;
			headerEl.textContent = jiaziDay + LONG_SPACE + yaoriDay;
			weatherEl.textContent = WEATHER_CODES[weather.daily.weather_code[i]];
			highEl.textContent = temperatureText(weather.daily.temperature_2m_max[i]);
			lowEl.textContent = temperatureText(weather.daily.temperature_2m_min[i]);
			newRow.appendChild(jieqiEl);
			newRow.appendChild(headerEl);
			newRow.appendChild(weatherEl);
			newRow.appendChild(highEl);
			newRow.appendChild(lowEl);
			dailyTable.appendChild(newRow);
		}
	})
}

function updateDate(currDate) {
	let lunarDate = Lunar.fromDate(currDate);

	setText('lunar-date',
		lunarDate.getYearInGanZhiExact() + YEAR
		+ lunarDate.getMonthInChinese() + MONTH
		+ lunarDate.getDayInChinese()
		+ LONG_SPACE + lunarDate.getDayInGanZhi()
		+ LONG_SPACE + jiaziHour(currDate.getHours()) + keFromMins(currDate.getMinutes())
	);

	setText('western-date',
		hanziDigits(currDate.getFullYear()) + YEAR
		+ hanziNum(currDate.getMonth() + 1) + MONTH
		+ hanziNum(currDate.getDate()) + DAY
		+ LONG_SPACE + 曜日順序[currDate.getDay()] + "曜日"
		+ LONG_SPACE + hanziNum(currDate.getHours()) + "時" + hanziNum(currDate.getMinutes()) + "分"
	);

	let jieQiSimplified = lunarDate.getPrevJieQi().getName();
	let jieQi = SOLAR_TERMS_TRADITIONAL[jieQiSimplified] ?? jieQiSimplified;

	setText('curr-jieqi',
		jieQi
	);
}

updateDate(new Date());
navigator.geolocation.getCurrentPosition((position) => {
	updateWeather(position.coords.latitude, position.coords.longitude);
});

setInterval(() => {
	updateDate(new Date());
}, 5 * 1000);

setInterval(() => {
	navigator.geolocation.getCurrentPosition((position) => {
		updateWeather(position.coords.latitude, position.coords.longitude);
	});
}, 30 * 1000);