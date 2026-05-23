# hankie

**hankie** is a simple [Gnome Shell extension](https://extensions.gnome.org/)
that shows the total number of Anki cards due today in the top bar.

To use this extension, you must first install
the [AnkiConnect](https://ankiweb.net/shared/info/2055492159) add-on.

## Testing

```console
# See https://gjs.guide/extensions/development/creating.html
$ sh install.sh
$ GTK_A11Y=none dbus-run-session gnome-shell --nested --wayland
```

## License

This extension is released under the MIT License.
