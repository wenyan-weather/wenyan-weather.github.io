'use strict';

import { fetchWeatherApi } from "https://esm.sh/openmeteo";
import * as cn from "https://unpkg.com/chinese-numbering@1.x/bundle/es.js";
import { differenceInYears } from 'https://cdn.skypack.dev/date-fns';

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

	"80": "小俄雨",
	"81": "俄雨",
	"82": "驟雨",
	"85": "小俄雪",
	"86": "俄雪",

	"95": "雷雨",
	"96": "雷小雹",
	"97": "大雷雨",
	"99": "雷大雹"
};

const BEAUFORT_SCALE = {
	0: "無風",
	5: "軟風",
	11: "輕風",
	19: "微風",
	30: "和風",
	40: "清風",
	50: "強風",
	61: "疾風",
	74: "大風",
	88: "烈風",
	102: "狂風",
	117: "暴風",
	132: "颶風",

	149: "輕度颱風",
	184: "中度颱風",
	999: "強烈颱風"
};

// This is needed bc the Lunar library outputs solar terms in simplified
const SOLAR_TERMS_TRADITIONAL = {
	"惊蛰": "驚蟄",
	"谷雨": "穀雨",
	"小满": "小滿",
	"芒种": "芒種",
	"处暑": "處暑"
};

const MANSIONS_TRADITIONAL = {
	"婁": "娄",
	"毕": "畢",
	"张": "張",
	"轸": "軫"
};

const DAYS_OF_MONTH = {
	5: "初五",
	10: "初十",
	15: "望",
	20: "二十",
	25: "廿五"
};

const NUMBER_ABBREVIATIONS = {
	"二十": "廿",
	"三十": "卅",
	"四十": "卌"
};

const 天干順序 = "甲乙丙丁戊己庚辛壬癸";
const 地支順序 = "子丑寅卯辰巳午未申酉戌亥";
const DIGITS = {
	"circle": "〇一二三四五六七八九",
	"char": "零一二三四五六七八九"
};

const 曜日順序 = "日月火水木金土";
const 星期順序 = "日一二三四五六";

const JAPAN_CALENDAR_FORMATTER = new Intl.DateTimeFormat('ja-JP-u-ca-japanese', {
	era: 'long',
	year: 'numeric'
});

// "gregorian" refers to whether the months and days are counted by the Gregorian calendar. If false, the lunar months and days are used.
const CALENDARS = {
	"western": {
		"name": "西曆",
		"gregorian": true,
		"getYearName": date => hanziDigits(date.getFullYear()),
	},
	"japan": {
		"name": "日本曆",
		"gregorian": true,
		"getYearName": date => {
			const parts = JAPAN_CALENDAR_FORMATTER.formatToParts(date);
			const era = parts.find(p => p.type === 'era').value;
			const year = parts.find(p => p.type === 'year').value;
			return `${era}${shortHanziNum(year)}`;
		}
	},
	"taiwan": {
		"name": "中華民國",
		// 1912
		"epoch": new Date("+001912-01-01T00:00:00Z"),
		"gregorian": true,
	},
	"huangdi": {
		"name": "黃帝",
		"gregorian": false,
		"getYearName": date => shortHanziNum(
			// 2697 BC
			lunarYearsSince(-2696, date)
		)
	},
	"kouki": {
		"name": "皇紀",
		"gregorian": true,
		// 660 BC
		"epoch": new Date("-000659-01-01T00:00:00Z")
	},
	"buddhist": {
		"name": "佛歷",
		"gregorian": false,
		"getYearName": date => hanziDigits(
			Foto.fromLunar(Lunar.fromDate(date))
				.getYear()
		)
	},
	"dangun": {
		"name": "檀君",
		"gregorian": true,
		// 2333 BC
		"epoch": new Date("-002332-01-01T00:00:00Z")
	},
	"juche": {
		"name": "主體",
		"gregorian": true,
		// 1912
		"epoch": new Date("+001912-01-01T00:00:00Z")
	},
	"murica-lunar": {
		"name": "星條旗",
		"gregorian": false,
		"getYearName": date => shortHanziNum(
			lunarYearsSince(1776, date)
		)
	},
	"murica-solar": {
		"name": "星條旗",
		"gregorian": true,
		// July 4, 1776
		"epoch": new Date("+001776-07-04T00:00:00Z")
	}
};

/**
 * Lunar info about a date object.
 */
class LunarDateInfo {
	constructor(date) {
		this.lunarDate = Lunar.fromDate(date);
		this.lunarDay = this.lunarDate.getDay();
		this.weekdayShort = dayOfWeek(date, false);
		this.jiazi = this.lunarDate.getDayInGanZhi();
		this.jieQi = replaceAll(this.lunarDate.getJieQi(), SOLAR_TERMS_TRADITIONAL);

		// On special days of the month, as defined by DAYS_OF_MONTH, we need to display the day of the month
		let specialLunarDay =
			(this.lunarDay == 1)
			? this.lunarDate.getMonthInChinese() + MONTH
			: (DAYS_OF_MONTH[this.lunarDay] ?? "");
		// If it's a jieqi start day, that takes precedence
		this.specialDayString = this.jieQi ? this.jieQi : specialLunarDay;
	}
}

/**
 * Makes a series of text replacements in a string.
 * @param {*} text The text to transform.
 * @param {*} replacements An object where the keys are the replacement targets and the value is the target.
 * @returns The replaced string.
 */
function replaceAll(text, replacements) {
	for (let [key, value] of Object.entries(replacements)) {
		text = text.replace(key, value);
	}
	return text;
}

function weekdayType() {
	return document.getElementById('weekday-type-select').value;
}

function zeroType() {
	return document.getElementById('zero-symbol-select').value;
}

function shortNumsEnabled() {
	return document.getElementById('short-nums-select').checked;
}

/**
 * Sets the textContent of an element.
 */
function setText(id, text) {
	document.getElementById(id).textContent = String(text);
}

/**
 * Converts a number to a Hanzi string, with zero displayed as 〇.
 */
function hanziNum(n) {
	return cn.numberToChinese(n)
		.replace("零", "")
		.replace("〇", "")
		.replace("一十", "十");
}

/**
 * Converts a number to a Hanzi string, with zero displayed as 〇.
 * For conciseness, 20 is displayed as 廿, 30 as 卅, and 40 as 卌.
 */
function shortHanziNum(n) {
	let longNum = hanziNum(n);
	return shortNumsEnabled() ? replaceAll(longNum, NUMBER_ABBREVIATIONS) : longNum;
}

/**
 * Converts a number to a Hanzi string where each digit is written out.
 * 
 * For example, 239 becomes 二三九.
 */
function hanziDigits(n) {
	return [...String(n)]
		.map(d => DIGITS[zeroType()][d])
		.join('');
}

/**
 * Converts a temperature as a Number to text indicating that it is a temperature.
 * 
 * For example, 13.9 becomes 十四度.
 */
function temperatureText(temp) {
	return shortHanziNum(Math.round(temp)) + DEGREE_SYMBOL;
}

function dayOfWeek(date, long) {
	switch (weekdayType()) {
		case "yaori": {
			let short = 曜日順序[date.getDay()];
			return long ? short + "曜日" : short;
		}
		case "number": {
			let short = 星期順序[date.getDay()];
			return long ? "星期" + short : short;
		}
		case "mansions":
			return replaceAll(Lunar.fromDate(date).getXiu(), MANSIONS_TRADITIONAL);
	}
}

/**
 * Calculates the number of full lunar years between the start of the given lunar year and `date`.
 * @param {*} year A Gregorian calendar year. Note that, for example, Gregorian January 10, 2007 belongs to 2006 in the lunar calendar because the 2007 lunar new year had not yet begun on January 10.
 * @param {*} date The date to count years from.
 */
function lunarYearsSince(year, date) {
	return Lunar.fromDate(date).getYear() - year + 1
}

/**
 * Converts an hour number to the 12-hour system. For example, hour 0 is 子正 and hour 1 is 丑初. The hour number should be in the range 0-23 inclusive.
 */
function jiaziHour(hourNum) {
	let halfHourIdx = ((hourNum + 1) % 24) >> 1;
	return 地支順序[halfHourIdx] + "正初"[hourNum % 2];
}

/**
 * Gets the ke number based on the number of minutes that have passed in this hour.
 */
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
			time: new Date((Number(curr.time())) * 1000),
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
			weather_code: curr.variables(10).value(),
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
				(_ , i) => {
					// OpenMeteo provided most of the code in this section through a generator on their website, which would have returned the following here:
					// new Date((Number(daily.time()) + i * daily.interval()) * 1000)
					// This works except when there is a daylight savings time transition causing a day to be 25 hours, for example. In this case, adding 24 hours to midnight on the day of the transition will land on 23:00 on the same day, which will cause the same day to display twice. My corrected approach is below:
					let date = new Date(1000 * Number(daily.time()));
					date.setDate(date.getDate() + i);
					return date;
				}
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
 * Update weather widgets.
 */
function updateWeather(lat, long) {
	getWeather(lat, long).then(weather => {
		console.log(weather);

		/* Curr weather */

		let actTemp = Math.round(weather.current.temperature_2m);
		let feelTemp = Math.round(weather.current.apparent_temperature);
		// We only display "feels like" if the feels like temp is diff from true temp
		let currTemp = temperatureText(actTemp) + (
			(actTemp === feelTemp)
				? ("")
				: (LONG_SPACE + FEELS_LIKE + temperatureText(feelTemp))
		);

		// Find the cardinal wind direction
		let adjustedDir = (weather.current.wind_direction_10m + DIR_INTERVAL) % DEGREES_IN_CIRCLE;
		let windDir = DIRECTIONS[Math.floor(adjustedDir / DIR_INTERVAL)];
		let roundedWindSpeed = Math.round(weather.current.wind_speed_10m);

		let beaufortScale;
		Object.entries(BEAUFORT_SCALE).forEach(([maxWindSpd, name]) => {
			if (roundedWindSpeed <= maxWindSpd)
				beaufortScale = name;
		});

		let windSpeed = `一小時${shortHanziNum(roundedWindSpeed)}公里`;

		setText('curr-weather', WEATHER_CODES[weather.current.weather_code] + LONG_SPACE + currTemp);
		setText('wind-info', beaufortScale + LONG_SPACE + windSpeed + LONG_SPACE + windDir);

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
		let todayInfo = new LunarDateInfo(weather.current.time);

		setText('today-solar-term', todayInfo.specialDayString);
		setText('today-weather', WEATHER_CODES[weather.daily.weather_code[0]]);
		setText('today-high', temperatureText(weather.daily.temperature_2m_max[0]));
		setText('today-low', temperatureText(weather.daily.temperature_2m_min[0]));

		// For each day, add a line for its info
		for(let i = 1; i < weather.daily.time.length; ++i) {
			let currDayInfo = new LunarDateInfo(weather.daily.time[i]);

			let newRow = document.createElement('tr');
			let jieqiEl = document.createElement('td');
			let headerEl = document.createElement('th');
			let weatherEl = document.createElement('td');
			let highEl = document.createElement('td');
			let lowEl = document.createElement('td');

			jieqiEl.textContent = currDayInfo.specialDayString;
			headerEl.textContent = currDayInfo.jiazi + LONG_SPACE + currDayInfo.weekdayShort;
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

/**
 * Update the current date on the date widget.
 */
function updateDate() {
	let currDate = new Date();
	let lunarDate = Lunar.fromDate(currDate);

	let calendarName = document.getElementById('year-numbering-select').value;
	let calendarInfo = CALENDARS[calendarName];

	// Build up the year name

	let yearName;
	if (calendarInfo.epoch) {
		let yearNum = 1 + differenceInYears(currDate, calendarInfo.epoch);
		yearName = yearNum == 1 ? "元" : shortHanziNum(yearNum);
	} else {
		yearName = calendarInfo.getYearName(currDate);
	}
	yearName += YEAR;

	// Other components of a date

	let lunarMonthDay =
		lunarDate.getMonthInChinese() + MONTH
		+ lunarDate.getDayInChinese();

	let altTime = shortHanziNum(currDate.getHours()) + "時" + shortHanziNum(currDate.getMinutes()) + "分";
	let chineseTime = jiaziHour(currDate.getHours()) + keFromMins(currDate.getMinutes());

	// Build up the full alt date

	let altDate = yearName;

	if (calendarInfo.gregorian) {
		altDate += shortHanziNum(currDate.getMonth() + 1) + MONTH
			+ shortHanziNum(currDate.getDate()) + DAY;
	} else {
		altDate += lunarMonthDay;
	}
	altDate += LONG_SPACE + dayOfWeek(currDate, true) + LONG_SPACE + altTime;

	setText('alt-calendar-name', calendarInfo.name);

	setText('lunar-date',
		lunarDate.getYearInGanZhiExact() + YEAR
		+ lunarMonthDay
		+ LONG_SPACE + lunarDate.getDayInGanZhi()
		+ LONG_SPACE + chineseTime
	);

	setText('western-date', altDate);

	let jieQi = replaceAll(lunarDate.getPrevJieQi(true).getName(), SOLAR_TERMS_TRADITIONAL);
	setText('curr-jieqi', jieQi);
}

/**
 * Update the whole website and save settings.
 */
function updateEverything() {
	updateDate();
	navigator.geolocation.getCurrentPosition((position) => {
		updateWeather(position.coords.latitude, position.coords.longitude);
	});
}

// Get previous settings from localstorage
document.getElementById("settings")
	.querySelectorAll("input, select")
	.forEach(input =>
{
	const savedValue = localStorage.getItem(input.id || input.name);

	// Skip this field if there is no saved value
	if (savedValue === null || savedValue === undefined) {
		return;
	}

	// Change the selection to match local storage
	if (input.type === "checkbox" || input.type === "radio") {
        input.checked = savedValue === "true";
    } else {
        input.value = savedValue;
    }
});

// Update everything on load
updateEverything();

// Update date widget every 5 secs
setInterval(() => {
	updateDate();
}, 5 * 1000);

// Update weather every 30 secs
setInterval(() => {
	navigator.geolocation.getCurrentPosition((position) => {
		updateWeather(position.coords.latitude, position.coords.longitude);
	});
}, 30 * 1000);

// User changed a setting
document.addEventListener('input', event => {
    // Check if the changed element is an input or a select
    if (['INPUT', 'SELECT'].includes(event.target.tagName)) {
        updateEverything();
		let settingName = event.target.id || event.target.name;
		let settingValue = event.target.type === "checkbox" ? event.target.checked : event.target.value;
		localStorage.setItem(settingName, settingValue);
    }
});