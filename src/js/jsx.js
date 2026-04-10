// JSX string factory — esbuild compiles JSX syntax to h() calls at build time.
// The h() function runs at runtime to produce HTML strings.
// Used as jsxFactory (h) and jsxFragment (Fragment) in vite.config.js.

const VOID_ELEMENTS = new Set([
	'area',
	'base',
	'br',
	'col',
	'embed',
	'hr',
	'img',
	'input',
	'link',
	'meta',
	'source',
	'track',
	'wbr',
])

function escapeHTML(str) {
	if (str == null) return ''
	return String(str)
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;')
}

const RAW = Symbol('rawHTML')

function renderChildren(children) {
	let html = ''
	for (const child of children) {
		if (child == null || child === false || child === true) continue
		if (Array.isArray(child)) {
			html += renderChildren(child)
		} else if (child[RAW] !== undefined) {
			html += child[RAW]
		} else {
			html += escapeHTML(child)
		}
	}
	return html
}

function tagged(str) {
	return {
		[RAW]: str,
		toString: function () {
			return str
		},
	}
}

export function h(tag, props, ...children) {
	// Fragment — just render children
	if (tag === Fragment) {
		return tagged(renderChildren(children))
	}

	let html = '<' + tag

	if (props) {
		for (const key in props) {
			if (key === '__source' || key === '__self') continue
			const val = props[key]
			if (val == null || val === false) continue
			if (val === true) {
				html += ' ' + key
			} else {
				html += ' ' + key + '="' + escapeHTML(val) + '"'
			}
		}
	}

	if (VOID_ELEMENTS.has(tag)) {
		return tagged(html + '>')
	}

	html += '>'
	html += renderChildren(children)
	html += '</' + tag + '>'
	return tagged(html)
}

export function Fragment() {
	/* JSX fragment — no-op */
}

// Wraps a string so renderChildren treats it as pre-escaped HTML.
// Use for API content that is already HTML (e.g. comment bodies).
export function rawHTML(str) {
	return tagged(str || '')
}
