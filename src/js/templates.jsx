// biome-ignore lint/correctness/noUnusedImports: h is used by JSX transform
import { Fragment, h, rawHTML } from './jsx.js'

function renderCommentsToggle(data) {
	return (
		<button type="button" class="comments-toggle">
			{data.comments_count} {data.i_reply}
		</button>
	)
}

function renderCommentsList(data) {
	if (!data.comments?.length) return ''
	return rawHTML(
		data.comments
			.map(function (c) {
				return (
					<li>
						<p class={'metadata' + (c.deleted ? ' deleted' : '')}>
							<button
								type="button"
								class="collapse-parent"
								aria-label="Collapse thread"
							></button>
							{c.deleted ? (
								<span>[deleted]</span>
							) : (
								<a
									href={'https://news.ycombinator.com/user?id=' + c.user}
									target="_blank"
									rel="noopener"
								>
									<b class="user">{c.user}</b>
								</a>
							)}
							<time>
								<a
									href={'https://news.ycombinator.com/item?id=' + c.id}
									target="_blank"
									rel="noopener"
								>
									{c.time_ago}
								</a>
							</time>
						</p>
						{!c.deleted && (
							<p>
								{rawHTML(c.content || '')}
								<ul>{renderCommentsList(c)}</ul>
							</p>
						)}
					</li>
				)
			})
			.join(''),
	)
}

function renderPostComments(data) {
	return (
		<Fragment>
			<div class="post-content">
				{data.has_post && (
					<header>
						<a href={data.url} target="_blank" rel="noopener">
							<h1>{data.title}</h1>
							{data.user && data.domain && <span class="link-text">{data.domain}</span>}
						</a>
						<p class="metadata">
							{data.user ? (
								<Fragment>
									<span class="inline-block">
										{data.points} {data.i_point} by {data.user}
									</span>{' '}
									<span class="inline-block">
										{data.time_ago}
										{data.comments_count && (
											<Fragment>
												{' \u00b7 '}
												{data.comments_count} {data.i_comment}
											</Fragment>
										)}
									</span>
								</Fragment>
							) : (
								<span class="inline-block">{data.time_ago}</span>
							)}
							<a
								href={data.hn_url}
								target="_blank"
								class="external-link"
								rel="noopener"
							>
								{data.short_hn_url}
							</a>
						</p>
					</header>
				)}
				{data.has_content && (
					<section class="grouped-tableview">
						{rawHTML(data.content || '')}
						{data.has_poll && (
							<ul class="poll">
								{data.poll &&
									rawHTML(
										data.poll
											.map(function (p) {
												return (
													<li title={p.percentage + '%'}>
														<span class="poll-details">
															<b>{p.item}</b>{' '}
															<span class="points">
																{p.points} {p.i_point}
															</span>
														</span>
														<div class="poll-bar">
															<span style={'width: ' + p.width}></span>
														</div>
													</li>
												)
											})
											.join(''),
									)}
							</ul>
						)}
					</section>
				)}
			</div>
			<section class="comments">
				{data.loading && (
					<div class="loader">
						<i class="icon-loading"></i> {'Loading\u2026'}
					</div>
				)}
				{data.load_error && (
					<div class="load-error">
						{"Couldn't load comments."}
						<br />
						<button type="button">Try again</button>
					</div>
				)}
				{!data.loading && !data.load_error && (
					<Fragment>
						{data.has_comments ? (
							<ul>{renderCommentsList(data)}</ul>
						) : (
							<p class="no-comments">No comments.</p>
						)}
					</Fragment>
				)}
			</section>
		</Fragment>
	)
}

function renderPost(item) {
	const classes = ['detail-disclosure', item.selected && 'selected']
		.filter(Boolean)
		.join(' ')

	return (
		<li id={'story-' + item.id} data-index={item.i} class={'post-' + item.type}>
			<a
				href={item.url}
				target={item.external ? '_blank' : null}
				rel={item.external ? 'noopener' : null}
				class={classes || null}
			>
				<div class="number">{item.i}</div>
				<div class="story">
					<b>{item.title}</b>
					{item.user ? (
						<div class="metadata">
							{item.domain && <div class="link-text">{item.domain}</div>}
							<span class="inline-block">
								{item.points} {item.i_point} by {item.user}
							</span>{' '}
							<span class="inline-block">
								{item.time_ago}
								{item.cached && (
									<span
										class={
											'cached-indicator' + (item.cached === 'pending' ? ' pending' : '')
										}
										title={
											item.cached === 'cached' ? 'Available offline' : 'Caching\u2026'
										}
									></span>
								)}
							</span>
						</div>
					) : (
						<div class="metadata">
							{item.domain && (
								<Fragment>
									<span class="link-text">{item.domain}</span>
									<br />
								</Fragment>
							)}
							<span class="inline-block">
								{item.time_ago}
								{item.cached && (
									<span
										class={
											'cached-indicator' + (item.cached === 'pending' ? ' pending' : '')
										}
										title={
											item.cached === 'cached' ? 'Available offline' : 'Caching\u2026'
										}
									></span>
								)}
							</span>
						</div>
					)}
				</div>
			</a>
			<a href={'#/item/' + item.id} class="detail-disclosure-button">
				<span></span>
				<b class="comments-count">{item.comments_count}</b>
			</a>
		</li>
	)
}

function renderStoriesLoad(data) {
	return (
		<Fragment>
			{data.loading && (
				<div class="loader">
					<i class="icon-loading"></i> {'Loading\u2026'}
				</div>
			)}
			{data.load_error && <div class="load-error">{"Couldn't load stories."}</div>}
		</Fragment>
	)
}

const TEMPLATES = {
	'comments-toggle': renderCommentsToggle,
	comments: renderCommentsList,
	'post-comments': renderPostComments,
	post: renderPost,
	'stories-load': renderStoriesLoad,
}

export default TEMPLATES
