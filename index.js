const util = require('util')

function assert(condition, message) {
	if (!condition) throw new Error(message)
}
function notString(str) {
	return str === null || str === undefined || str.constructor !== String
}
function assertIsString(str) {
	if (notString(str)) throw new Error('Expected a string, but got: ' + util.inspect(str))
}
function assertIsRegExp(re) {
	if (!(re instanceof RegExp)) throw new Error('Expected a regular expression, but got: ' + util.inspect(re))
}
function assertIsNumber(num) {
	if (num === null || num === undefined || num.constructor !== Number) throw new Error('Expected a number, but got: ' + util.inspect(num))
}
function assertIsChar(char) {
	assertIsString(char)
	assert(char.length === 1, '"' + char + '" is not 1 character')
}

function getCaptureGroups(re) {
	return re.groups || new Map
}
function escapeForRegEx(str) {
	return str.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')
		.replace(/\t/g, '\\t')
		.replace(/\r/g, '\\r')
		.replace(/\n/g, '\\n')
		.replace(/\v/g, '\\v')
		.replace(/\f/g, '\\f')
		.replace(/[\b]/g, '\\b') //wrapping in character class must be done by caller
		.replace(/\0/g, '\\0')
}
function wrapInGroup(re) {
	return new RegExp('(?:' + re.source + ')')
}
function characterString(chars) {
	let str = ''
	for (const char of chars) {
		if (char instanceof Array) {
			assert(char.length === 2, 'Expected 2 characters, but got: ' + util.inspect(char))
			for (const c of char) assertIsChar(c)
			str += escapeForRegEx(char[0]) + '-' + escapeForRegEx(char[1])
		}
		else {
			assertIsChar(char)
			str += escapeForRegEx(char)
		}
	}
	return str
}

class ReadableRegExp extends RegExp {
	constructor(sections, flags) {
		if (!(sections instanceof Array)) sections = [sections]
		let concatenation = ''
		const captureGroups = new Map
		let captureIndex = 0
		for (const section of sections) {
			if (notString(section)) {
				assertIsRegExp(section)
				for (const [captureName, _] of getCaptureGroups(section)) {
					captureGroups.set(captureName, captureIndex)
					captureIndex++
				}
				concatenation += section.source
			}
			else {
				const text = escapeForRegEx(section).replace(/\\b/g, '[\\b]')
				concatenation += wrapInGroup(new RegExp(text)).source
			}
		}
		if (flags === undefined) {
			if (sections.length === 1) super(concatenation)
			else super(wrapInGroup(new RegExp(concatenation)).source)
		}
		else {
			if (!(flags instanceof Array)) flags = [flags]
			let flagString = ''
			for (const flag of flags) {
				if (!(flag instanceof Flag)) throw new Error('Expected a flag, but got: ' + util.inspect(flag))
				flagString += flag.str
			}
			if (sections.length !== 1) concatenation = '(?:' + concatenation + ')'
			super(concatenation, flagString)
		}
		this.groups = captureGroups
	}
}
const reg = module.exports = function(...args) {
	return new ReadableRegExp(...args)
}
class Flag {
	constructor(str) {
		this.str = str
	}
}
Object.assign(module.exports, {
	f: {
		GLOBAL: new Flag('g'),
		IGNORE_CASE: new Flag('i'),
		MULTILINE: new Flag('m'),
		UNICODE: new Flag('u'),
		STICKY: new Flag('y')
	},
	ANY: wrapInGroup(/./), //wrapping might not be necessary
	DIGIT: wrapInGroup(/\d/), //wrapping might not be necessary
	START: wrapInGroup(/^/), //wrapping might not be necessary
	END: wrapInGroup(/$/), //wrapping might not be necessary
	ALPHANUM: wrapInGroup(/\w/), //wrapping might not be necessary
	NOT_ALPHANUM: wrapInGroup(/\W/), //wrapping might not be necessary
	WHITESPACE: wrapInGroup(/\s/), //wrapping might not be necessary
	NOT_WHITESPACE: wrapInGroup(/\S/), //wrapping might not be necessary
	WORD_BOUND: wrapInGroup(/\b/), //wrapping might not be necessary
	IN_WORD: wrapInGroup(/\B/), //wrapping might not be necessary
	times(re, notGreedy, min, max) {
		assertIsRegExp(re)
		assertIsNumber(min)
		let timesString = '{' + String(min) + ','
		if (max !== undefined) {
			assertIsNumber(max)
			timesString += String(max)
		}
		timesString += '}'
		if (notGreedy) timesString += '?'
		return wrapInGroup(new RegExp(re.source + timesString)) //wrapping might not be necessary
	},
	any(re, notGreedy) {
		return reg.times(re, notGreedy, 0)
	},
	some(re, notGreedy) {
		return reg.times(re, notGreedy, 1)
	},
	maybe(re, notGreedy) {
		return reg.times(re, notGreedy, 0, 1)
	},
	thisMany(re, times, notGreedy) {
		return reg.times(re, notGreedy, times, times)
	},
	capture(re, name) {
		assertIsRegExp(re)
		assertIsString(name)
		const newRe = new RegExp('(' + re.source + ')')
		const captureGroups = new Map().set(name, 0)
		let captureIndex = 1
		for (const [captureName, _] of getCaptureGroups(re)) {
			captureGroups.set(captureName, captureIndex)
			captureIndex++
		}
		newRe.groups = captureGroups
		return newRe
	},
	charIn(...chars) {
		return wrapInGroup(new RegExp('[' + characterString(chars) + ']')) //wrapping might not be necessary
	},
	charNotIn(...chars) {
		return wrapInGroup(new RegExp('[^' + characterString(chars) + ']')) //wrapping might not be necessary
	},
	or(...res) {
		assert(res.length, 'Cannot or 0 regular expressions')
		let concatenation = ''
		const captureGroups = new Map
		let captureIndex = 0
		for (const re of res) {
			assertIsRegExp(re)
			concatenation += re.source + '|'
			for (const [captureName, _] of getCaptureGroups(re)) {
				captureGroups.set(captureName, captureIndex)
				captureIndex++
			}
		}
		const re = wrapInGroup(new RegExp(concatenation.substring(0, concatenation.length - 1)))
		re.groups = captureGroups
		return re
	},
	exec(re, str) {
		assertIsRegExp(re)
		assertIsString(str)
		const match = re.exec(str)
		if (match) {
			match.get = captureName => {
				const captureIndex = getCaptureGroups(re).get(captureName)
				assert(captureIndex !== undefined, 'Could not find capture "' + captureName + '"')
				return match[captureIndex + 1]
			}
		}
		return match
	}
})