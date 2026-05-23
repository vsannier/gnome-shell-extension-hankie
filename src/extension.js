import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";

import * as Main from "resource:///org/gnome/shell/ui/main.js";
import * as PanelMenu from "resource:///org/gnome/shell/ui/panelMenu.js";

import Clutter from "gi://Clutter";
import GLib from "gi://GLib";
import Shell from "gi://Shell";
import Soup from "gi://Soup";
import St from "gi://St";

const ANKI_CONNECT_URL = "http://127.0.0.1:8765";

export default class HankieExtension extends Extension {
  enable() {
    this._label = new St.Label({ y_align: Clutter.ActorAlign.CENTER });

    this._indicator = new PanelMenu.Button(0.0, "Hankie");
    this._indicator.add_child(this._label);
    Main.panel.addToStatusArea("hankie", this._indicator);

    this._indicatorId = this._indicator.connect(
      "button-press-event",
      (_, event) => {
        if (event.get_button() === 1) {
          this._launchAnki();
          return Clutter.EVENT_STOP;
        }
        return Clutter.EVENT_PROPAGATE;
      },
    );

    this._connectId = GLib.timeout_add_seconds(
      GLib.PRIORITY_DEFAULT,
      10, // send a request to AnkiConnect every 10 seconds
      () => {
        this._requestCounts();
        return GLib.SOURCE_CONTINUE;
      },
    );

    this._session = new Soup.Session();
    this._requestCounts();
  }

  _launchAnki() {
    const appSystem = Shell.AppSystem.get_default();
    const app =
      appSystem.lookup_app("anki.desktop") ||
      appSystem.lookup_app("net.ankiweb.Anki.desktop");

    if (app) {
      app.activate();
    } else {
      GLib.spawn_command_line_async("anki");
    }
  }

  _formatCounts(newCount, learnCount, reviewCount) {
    const newSpan = `<span color="#93c5fd">${newCount ?? "?"}</span>`;
    const learnSpan = `<span color="#f87171">${learnCount ?? "?"}</span>`;
    const reviewSpan = `<span color="#22c55e">${reviewCount ?? "?"}</span>`;
    // NOTE: for some reason,
    // without a dummy character at the start of the string,
    // the first span is rendered in white
    return `&#x200E;${newSpan} ${learnSpan} ${reviewSpan}`;
  }

  async _sendRequest(action, params = {}) {
    const message = Soup.Message.new("POST", ANKI_CONNECT_URL);
    const payload = JSON.stringify({ action, version: 6, params });
    const bytes = new GLib.Bytes(new TextEncoder().encode(payload));
    message.set_request_body_from_bytes("application/json", bytes);

    const responseBytes = await this._session.send_and_read_async(
      message,
      GLib.PRIORITY_DEFAULT,
      null,
    );

    const responseText = new TextDecoder().decode(responseBytes.get_data());
    const response = JSON.parse(responseText);

    if (response.error) {
      throw new Error(response.error);
    }
    return response.result;
  }

  async _requestCounts() {
    let newCount = null;
    let learnCount = null;
    let reviewCount = null;

    try {
      const allDecks = await this._sendRequest("deckNames");
      const topLevelDecks = allDecks.filter((deck) => !deck.includes("::"));

      const stats = await this._sendRequest("getDeckStats", {
        decks: topLevelDecks,
      });

      newCount = 0;
      learnCount = 0;
      reviewCount = 0;

      for (const deckId in stats) {
        const deck = stats[deckId];

        newCount += deck.new_count ?? 0;
        learnCount += deck.learn_count ?? 0;
        reviewCount += deck.review_count ?? 0;
      }
    } catch (e) {}

    if (this._label) {
      this._label.clutter_text.set_markup(
        this._formatCounts(newCount, learnCount, reviewCount),
      );
    }
  }

  disable() {
    if (this._connectId) {
      GLib.source_remove(this._connectId);
      this._connectId = null;
    }

    if (this._session) {
      this._session.abort();
      this._session = null;
    }

    if (this._label) {
      this._label.destroy();
      this._label = null;
    }

    if (this._indicator) {
      if (this._indicatorId) {
        this._indicator.disconnect(this._indicatorId);
        this._indicatorId = null;
      }
      this._indicator.destroy();
      this._indicator = null;
    }

    this._label = null;
  }
}
