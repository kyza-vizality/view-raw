const { React, getModule } = require("@vizality/webpack");
const { FormTitle } = require("@vizality/components");
const { Category } = require("@vizality/components/settings");
const { Modal } = require("@vizality/components");
const { close } = require("@vizality/modal");

const classes = getModule("markup");
const parser = getModule("parse", "parseTopic");

const ZWS = "\u200B";
const ZWS_RE = /\u200B|\u200C|\u200D|\u2060|\u180E/;

function strToReact(str) {
	const zws = <span className="zws">{ZWS}</span>;
	return str
		.split(ZWS_RE)
		.reduce((r, a) => r.concat(zws, a), [])
		.slice(1);
}

// What the hell is this.
function parseContent(content) {
	const res = parser.defaultRules.codeBlock.react({ content }, null, {});
	const ogRender = res.props.render;
	res.props.render = (codeblock) => {
		const res = ogRender(codeblock);
		if (typeof res.props.children.props.children === "string") {
			res.props.children.props.children = strToReact(
				res.props.children.props.children
			);
		} else {
			const props = res.props.children.props.children.props.children[1].props;
			if (Array.isArray(props.children)) {
				props.children.forEach((c) => {
					c.props.children[1].props.children = strToReact(
						c.props.children[1].props.children
					);
				});
			} else {
				props.children.props.children[1].props.children = strToReact(
					props.children.props.children[1].props.children
				);
			}
		}
		return res;
	};
	return res;
}

class ViewRawModal extends React.PureComponent {
	constructor(props) {
		super(props);

		this.state = { viewAllRawData: !props.message.content };
	}

	render() {
		const { message } = this.props,
			allRawData = this.props.allRawData || !message.embeds.length;
		return (
			<Modal size={Modal.Sizes.LARGE} className="vrmodal">
				<Modal.Header>
					<FormTitle tag="h4">
						Raw message written by {message.author.username}
					</FormTitle>
					<Modal.CloseButton onClick={close} />
				</Modal.Header>
				<Modal.Content className={classes.markup}>
					{message.content ? parseContent(message.content) : null}
					<Category
						name={allRawData ? "View All Raw Data" : "View Raw Embeds"}
						opened={this.state.viewAllRawData}
						onChange={() =>
							this.setState({
								viewAllRawData: !this.state.viewAllRawData,
							})
						}
					>
						{parser.defaultRules.codeBlock.react(
							{
								content: JSON.stringify(
									allRawData ? message : message.embeds,
									null,
									"\t"
								),
								lang: "json",
							},
							null,
							{}
						)}
					</Category>
				</Modal.Content>
			</Modal>
		);
	}
}

// Might as well.
module.exports =
	window.KLibrary?.Tools?.ReactTools?.WrapBoundary?.(ViewRawModal) ||
	ViewRawModal;
