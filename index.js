const { Plugin } = require("@vizality/entities");
const { push: openModal } = require("@vizality/webpack").modal;
const {
	react: { findInReactTree },
} = require("@vizality/util");
const { getModule, React } = require("@vizality/webpack");
const { patch, unpatch } = require("@vizality/patcher");

const Settings = require("./components/Settings");
const ViewRawButton = require("./components/ViewRawButton");
const Modal = require("./components/ViewRawModal");

const { clipboard } = getModule("clipboard");
const { MenuGroup, MenuItem } = getModule("MenuGroup", "MenuItem");
const MessageContextMenu = getModule(
	(m) => m?.default?.displayName === "MessageContextMenu"
);
const MiniPopover = getModule((m) => m?.default?.displayName === "MiniPopover");

module.exports = class ViewRaw extends Plugin {
	start() {
		// vizality.api.settings.registerSettings(this.entityID, {
		// 	category: this.entityID,
		// 	label: "View Raw",
		// 	render: (p) =>
		// 		React.createElement(Settings, {
		// 			repatch: () => this.addButtons(true),
		// 			...p,
		// 		}),
		// });
		this.injectStyles("style.css");

		this.addButtons();
	}

	stop() {
		// vizality.api.settings.unregisterSettings(this.entityID);
		this.addButtons(true, true);
		document
			.querySelectorAll(".view-raw-button")
			.forEach((e) => (e.style.display = "none"));
	}

	async addButtons(repatch, un) {
		if (repatch) {
			unpatch("view-raw-toolbar");
			unpatch("view-raw-contextmenu");
		}
		if (un) return;

		if (this.settings.get("toolbar", true)) {
			patch("view-raw-toolbar", MiniPopover, "default", (_, res) => {
				const props = findInReactTree(res, (r) => r?.message);
				if (!props) return res;

				res.props.children.unshift(
					React.createElement(ViewRawButton, {
						allRawData: this.settings.get("allRawData"),
						message: this.patchMessage(props.message),
					})
				);
				return res;
			});
			MiniPopover.default.displayName = "MiniPopover";
		}

		if (!this.settings.get("contextMenu", true)) return;
		patch(
			"view-raw-contextmenu",
			MessageContextMenu,
			"default",
			(args, res) => {
				if (!args[0]?.message || !res?.props?.children) return res;
				const message = this.patchMessage(args[0].message);

				res.props.children.splice(
					4,
					0,
					React.createElement(
						MenuGroup,
						null,
						React.createElement(MenuItem, {
							action: () =>
								openModal(() =>
									React.createElement(Modal, {
										allRawData: this.settings.get("allRawData"),
										message,
									})
								),
							id: "view-raw",
							label: "View Raw",
						}),
						React.createElement(MenuItem, {
							action: () => clipboard.copy(message.content),
							disabled: !message.content,
							id: "copy-raw",
							label: "Copy Raw",
						})
					)
				);
				return res;
			}
		);
		MessageContextMenu.default.displayName = "MessageContextMenu";
	}
	patchMessage(msg) {
		const message = _.cloneDeep(msg);
		// Censor personal data.
		for (const data in message.author) {
			if (
				typeof message.author[data] !== "function" &&
				[
					"id",
					"username",
					"usernameNormalized",
					"discriminator",
					"avatar",
					"bot",
					"system",
					"publicFlags",
				].indexOf(data) === -1
			)
				delete message.author[data];
		}
		// JSONify embed keys. Making easier to use them in e.g. bots.
		message.embeds = message.embeds.map((e) => {
			delete e.id;
			this.jsonifyEmbedKeys(e);
			for (const k of Object.keys(e).filter((k) => typeof e[k] == "object")) {
				if (!Array.isArray(e[k])) this.jsonifyEmbedKeys(e[k]);
				else
					e[k].map((el) =>
						typeof el === "object" && !Array.isArray(el)
							? this.jsonifyEmbedKeys(el)
							: el
					);
			}
			return e;
		});
		return message;
	}
	jsonifyEmbedKeys(e) {
		for (const k of Object.keys(e)) {
			const newKey = k
				.replace("URL", "_url")
				.replace(/[A-Z]/g, (l) => "_" + l.toLowerCase())
				.replace("raw_", "");
			if (newKey === k) continue;
			e[newKey] = e[k];
			delete e[k];
		}
		return e;
	}
};
