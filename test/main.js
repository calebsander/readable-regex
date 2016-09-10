const assert = require('assert')
const reg = require(__dirname + '/../index.js')

function assertEqual(re, {source, flags = '', groups = new Map}) {
	assert(re instanceof RegExp)
	assert.strictEqual(re.source, source)
	assert.strictEqual(re.flags, flags)
	const reGroups = re.groups || new Map
	assert.strictEqual(reGroups.size, groups.size)
	const expectedIterator = reGroups.entries()
	const actualIterator = groups.entries()
	let entry
	while (!(entry = expectedIterator.next()).done) assert.deepStrictEqual(entry.value, actualIterator.next().value)
}

assert.throws(
	() => reg(),
	/^Error: Expected a regular expression, but got: undefined$/
)
assert.throws(
	() => reg(2),
	/^Error: Expected a regular expression, but got: 2$/
)
assertEqual(reg('a\tbc\b'), {source: '(?:a\\tbc[\\b])'})
assertEqual(reg(['abc']), {source: '(?:abc)'})
assertEqual(reg(['abc', reg('def')]), {source: '(?:(?:abc)(?:def))'})
assert.throws(
	() => reg('abc', 3),
	/^Error: Expected a flag, but got: 3$/
)
assertEqual(reg('abc', reg.f.GLOBAL), {source: '(?:abc)', flags: 'g'})
assertEqual(reg(['abc', 'def'], [
	reg.f.GLOBAL,
	reg.f.IGNORE_CASE,
	reg.f.MULTILINE,
	reg.f.UNICODE,
	reg.f.STICKY
]), {source: '(?:(?:abc)(?:def))', flags: 'gimuy'})
assertEqual(reg(['a', reg.times(reg.WHITESPACE, false, 3, 5)]), {source: '(?:(?:a)(?:(?:\\s){3,5}))'})
assertEqual(reg.ANY, {source: '(?:.)'})
assertEqual(reg.DIGIT, {source: '(?:\\d)'})
assertEqual(reg.START, {source: '(?:^)'})
assertEqual(reg.END, {source: '(?:$)'})
assertEqual(reg.ALPHANUM, {source: '(?:\\w)'})
assertEqual(reg.NOT_ALPHANUM, {source: '(?:\\W)'})
assertEqual(reg.WHITESPACE, {source: '(?:\\s)'})
assertEqual(reg.NOT_WHITESPACE, {source: '(?:\\S)'})
assertEqual(reg.WORD_BOUND, {source: '(?:\\b)'})
assertEqual(reg.IN_WORD, {source: '(?:\\B)'})
assertEqual(reg.times(reg('abc'), true, 10), {source: '(?:(?:abc){10,}?)'})
assertEqual(reg.any(reg('abc')), {source: '(?:(?:abc){0,})'})
assertEqual(reg.any(reg('abc'), true), {source: '(?:(?:abc){0,}?)'})
assertEqual(reg.some(reg('abc')), {source: '(?:(?:abc){1,})'})
assertEqual(reg.some(reg('abc'), true), {source: '(?:(?:abc){1,}?)'})
assertEqual(reg.maybe(reg('abc')), {source: '(?:(?:abc){0,1})'})
assertEqual(reg.maybe(reg('abc'), true), {source: '(?:(?:abc){0,1}?)'})
assertEqual(reg.thisMany(reg('abc'), 6), {source: '(?:(?:abc){6,6})'})
assertEqual(reg.thisMany(reg('abc'), 6, true), {source: '(?:(?:abc){6,6}?)'})
assert.throws(
	() => reg.charIn(3),
	/^Error: Expected a string, but got: 3$/
)
assert.throws(
	() => reg.charIn('ab'),
	/^Error: "ab" is not 1 character$/
)
assert.throws(
	() => reg.charIn(['z', 'a', 'y']),
	/^Error: Expected 2 characters, but got: \[ 'z', 'a', 'y' \]$/
)
assertEqual(reg.charIn(['a', 'z'], '1'), {source: '(?:[a-z1])'})
assertEqual(reg.charIn('\b', '\n', '\0', '\v', '\r', '\t', '\f'), {source: '(?:[\\b\\n\\0\\v\\r\\t\\f])'})
assertEqual(reg.some(reg.charNotIn('a', 'b', 'c', '\n')), {source: '(?:(?:[^abc\\n]){1,})'})
assert.throws(
	() => reg.or(),
	/^Error: Cannot or 0 regular expressions$/
)
assertEqual(reg.or(reg('abc'), reg.some(reg.DIGIT), reg('-')), {source: '(?:(?:abc)|(?:(?:\\d){1,})|(?:\\-))'})
const SOME_DIGITS = reg.some(reg.DIGIT)
const DATE_CAPTURE = reg([
	reg.START,
	reg.capture(
		reg([
			reg.or(
				reg.capture(
					reg.some(
						reg.charIn(['a', 'z'], ['A', 'Z'])
					),
					'month-text'
				),
				reg.capture(
					SOME_DIGITS,
					'month-num'
				)
			),
			'-',
			reg.capture(
				SOME_DIGITS,
				'day'
			),
			'-',
			reg.capture(
				reg.times(reg.DIGIT, false, 2, 4),
				'year'
			)
		]),
		'date'
	),
	reg.END
])
assertEqual(DATE_CAPTURE, {
	source: '(?:(?:^)((?:(?:((?:(?:[a-zA-Z]){1,}))|((?:(?:\\d){1,})))(?:\\-)((?:(?:\\d){1,}))(?:\\-)((?:(?:\\d){2,4}))))(?:$))',
	groups: new Map().set('date', 0).set('month-text', 1).set('month-num', 2).set('day', 3).set('year', 4)
})
const match = reg.exec(DATE_CAPTURE, 'Jan-5-2017')
assert.strictEqual(match.get('date'), 'Jan-5-2017')
assert.strictEqual(match.get('month-text'), 'Jan')
assert.strictEqual(match.get('month-num'), undefined)
assert.strictEqual(match.get('day'), '5')
assert.strictEqual(match.get('year'), '2017')
assert.throws(
	() => match.get('No such capture name'),
	/^Error: Could not find capture "No such capture name"$/
)
const match2 = reg.exec(DATE_CAPTURE, 'Jan-1st-09')
assert.strictEqual(match2, null)