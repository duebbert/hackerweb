function escapeHTML(str) {
	if (str == null) return '';
	return String(str)
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

function renderCommentsToggle(data) {
	return (
		'<button class="comments-toggle">' +
		escapeHTML(data.comments_count) +
		' ' +
		escapeHTML(data.i_reply) +
		'</button>'
	);
}

function renderCommentsList(data) {
	if (!data.comments || !data.comments.length) return '';
	var html = '';
	for (var i = 0; i < data.comments.length; i++) {
		var c = data.comments[i];
		html += '<li><p class="metadata ' + (c.deleted ? 'deleted' : '') + '">';
		html += '<button class="collapse-parent" aria-label="Collapse thread"></button>';
		if (c.deleted) {
			html += '<span>[deleted]</span>';
		} else {
			html +=
				'<a href="https://news.ycombinator.com/user?id=' +
				escapeHTML(c.user) +
				'" target="_blank"><b class="user">' +
				escapeHTML(c.user) +
				'</b></a>';
		}
		html +=
			'<time><a href="https://news.ycombinator.com/item?id=' +
			escapeHTML(c.id) +
			'" target="_blank">' +
			escapeHTML(c.time_ago) +
			'</a></time></p>';
		if (!c.deleted) {
			html += '<p>' + (c.content || '') + '<ul>' + renderCommentsList(c) + '</ul>';
		}
		html += '</li>';
	}
	return html;
}

function renderPostComments(data) {
	var html = '<div class="post-content">';

	if (data.has_post) {
		html += '<header><a href="' + escapeHTML(data.url) + '" target="_blank">';
		html += '<h1>' + escapeHTML(data.title) + '</h1>';
		if (data.user && data.domain) {
			html += '<span class="link-text">' + escapeHTML(data.domain) + '</span>';
		}
		html += '</a><p class="metadata">';
		if (data.user) {
			html +=
				'<span class="inline-block">' +
				escapeHTML(data.points) +
				' ' +
				escapeHTML(data.i_point) +
				' by ' +
				escapeHTML(data.user) +
				'</span> <span class="inline-block">' +
				escapeHTML(data.time_ago);
			if (data.comments_count) {
				html += ' &middot; ' + escapeHTML(data.comments_count) + ' ' + escapeHTML(data.i_comment);
			}
			html += '</span>';
		} else {
			html += '<span class="inline-block">' + escapeHTML(data.time_ago) + '</span>';
		}
		html +=
			'<a href="' +
			escapeHTML(data.hn_url) +
			'" target="_blank" class="external-link">' +
			escapeHTML(data.short_hn_url) +
			'</a></p></header>';
	}

	if (data.has_content) {
		html += '<section class="grouped-tableview">';
		html += data.content || '';
		if (data.has_poll) {
			html += '<ul class="poll">';
			if (data.poll) {
				for (var i = 0; i < data.poll.length; i++) {
					var p = data.poll[i];
					html +=
						'<li title="' +
						escapeHTML(p.percentage) +
						'%"><span class="poll-details"><b>' +
						escapeHTML(p.item) +
						'</b> <span class="points">' +
						escapeHTML(p.points) +
						' ' +
						escapeHTML(p.i_point) +
						'</span></span><div class="poll-bar"><span style="width: ' +
						escapeHTML(p.width) +
						'"></span></div></li>';
				}
			}
			html += '</ul>';
		}
		html += '</section>';
	}

	html += '</div><section class="comments">';

	if (data.loading) {
		html += '<div class="loader"><i class="icon-loading"></i> Loading&hellip;</div>';
	}
	if (data.load_error) {
		html += '<div class="load-error">Couldn\'t load comments.<br><button>Try again</button></div>';
	}
	if (!data.loading && !data.load_error) {
		if (data.has_comments) {
			html += '<ul>' + renderCommentsList(data) + '</ul>';
		} else {
			html += '<p class="no-comments">No comments.</p>';
		}
	}

	html += '</section>';
	return html;
}

function renderPost(item) {
	var html =
		'<li id="story-' +
		escapeHTML(item.id) +
		'" data-index="' +
		escapeHTML(item.i) +
		'" class="post-' +
		escapeHTML(item.type) +
		'"><a href="' +
		escapeHTML(item.url) +
		'"';
	if (item.external) {
		html += ' target="_blank" rel="noopener"';
	}
	html += ' class="';
	if (item.detail_disclosure) html += 'detail-disclosure';
	if (item.disclosure) html += 'disclosure';
	html += ' ';
	if (item.selected) html += 'selected';
	html +=
		'"><div class="number">' +
		escapeHTML(item.i) +
		'</div><div class="story"><b>' +
		escapeHTML(item.title) +
		'</b>';

	if (item.user) {
		html += '<div class="metadata">';
		if (item.domain) {
			html += '<div class="link-text">' + escapeHTML(item.domain) + '</div>';
		}
		html +=
			'<span class="inline-block">' +
			escapeHTML(item.points) +
			' ' +
			escapeHTML(item.i_point) +
			' by ' +
			escapeHTML(item.user) +
			'</span> <span class="inline-block">' +
			escapeHTML(item.time_ago);
		if (!item.detail_disclosure && item.comments_count) {
			html += ' &middot; ' + escapeHTML(item.comments_count) + ' ' + escapeHTML(item.i_comment);
		}
		html += '</span></div>';
	} else {
		html += '<div class="metadata">';
		if (item.domain) {
			html += '<span class="link-text">' + escapeHTML(item.domain) + '</span><br>';
		}
		html += '<span class="inline-block">' + escapeHTML(item.time_ago) + '</span></div>';
	}

	html += '</div></a>';
	if (item.detail_disclosure) {
		html +=
			'<a href="#/item/' +
			escapeHTML(item.id) +
			'" class="detail-disclosure-button"><span></span><b class="comments-count">' +
			escapeHTML(item.comments_count) +
			'</b></a>';
	}
	html += '</li>';
	return html;
}

function renderStoriesLoad(data) {
	var html = '';
	if (data.loading) {
		html += '<div class="loader"><i class="icon-loading"></i> Loading&hellip;</div>';
	}
	if (data.load_error) {
		html += '<div class="load-error">Couldn\'t load stories.</div>';
	}
	return html;
}

var TEMPLATES = {
	'comments-toggle': renderCommentsToggle,
	comments: renderCommentsList,
	'post-comments': renderPostComments,
	post: renderPost,
	'stories-load': renderStoriesLoad,
};

export default TEMPLATES;
