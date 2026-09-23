const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const html = fs.readFileSync(path.join(__dirname, '../public/app/index.html'), 'utf8');
const code = html.slice(
  html.indexOf('var MAP_STYLE_STORAGE_KEY'),
  html.indexOf('// Dynamic map center:')
);

function setup(saved, blocked = false) {
  const attributes = {};
  const selectors = [{ value: '' }, { value: '' }, { value: '' }];
  const stored = {};
  const layers = [];
  const context = vm.createContext({
    localStorage: {
      getItem() { if (blocked) throw Error('blocked'); return saved; },
      setItem(key, value) { if (blocked) throw Error('blocked'); stored[key] = value; }
    },
    document: {
      documentElement: { setAttribute(key, value) { attributes[key] = value; } },
      querySelectorAll(selector) {
        assert.equal(selector, '.map-style-select');
        return selectors;
      }
    },
    L: {
      tileLayer(url, options) {
        return { addTo(map) { layers.push({ url, options, map }); return this; } };
      }
    }
  });
  vm.runInContext(code, context);
  return { context, attributes, selectors, stored, layers };
}

test('new users start in Light gray with all three options', () => {
  const { context, attributes } = setup(null);
  assert.equal(attributes['data-map-style'], 'light-gray');
  const picker = context.buildMapStylePickerHTML();
  assert.match(picker, /value="light-gray" selected>Light gray/);
  assert.match(picker, /value="color">Color/);
  assert.match(picker, /value="muted">Muted/);
});

test('each valid preference is restored on reload', () => {
  for (const style of ['light-gray', 'color', 'muted']) {
    assert.equal(setup(style).attributes['data-map-style'], style);
  }
});

test('invalid stored values fall back safely', () => {
  assert.equal(setup('invalid').attributes['data-map-style'], 'light-gray');
});

test('selection updates all existing controls and newly rendered controls', () => {
  const { context, attributes, selectors, stored } = setup(null);
  for (const style of ['color', 'muted', 'light-gray']) {
    context.setMapStyle(style);
    assert.equal(attributes['data-map-style'], style);
    assert.ok(selectors.every(select => select.value === style));
    assert.equal(stored['tourlytics.mapStyle'], style);
    assert.ok(context.buildMapStylePickerHTML().includes(`value="${style}" selected`));
  }
  context.setMapStyle('invalid');
  assert.equal(attributes['data-map-style'], 'light-gray');
});

test('blocked browser storage does not break the map or style changes', () => {
  const { context, attributes } = setup(null, true);
  assert.equal(attributes['data-map-style'], 'light-gray');
  context.setMapStyle('muted');
  assert.equal(attributes['data-map-style'], 'muted');
});

test('picker change events apply the chosen style', () => {
  const { context, attributes } = setup(null);
  let handler;
  context.bindMapStylePicker({
    querySelector() {
      return { addEventListener(event, callback) {
        assert.equal(event, 'change');
        handler = callback;
      } };
    }
  });
  handler.call({ value: 'color' });
  assert.equal(attributes['data-map-style'], 'color');
});

test('all three maps use a filterable basemap with linked attribution', () => {
  const { context, layers } = setup(null);
  context.addStandardBasemap('test-map');
  assert.equal(layers[0].options.className, 'tl-basemap');
  assert.match(layers[0].options.attribution, /https:\/\/www.openstreetmap.org\/copyright/);
  assert.match(layers[0].url, /tile.openstreetmap.org/);
  assert.equal((html.match(/addStandardBasemap\((?:map|_commuteMap|_cmapLeaflet)\)/g) || []).length, 3);
  const css = html.slice(html.indexOf('/* Filter only'), html.indexOf('/* ==='));
  assert.match(css, /grayscale\(1\)/);
  assert.match(css, /saturate\(0.25\)/);
  assert.match(css, /filter: none/);
  assert.doesNotMatch(css, /\.leaflet-marker|\.leaflet-overlay|\.leaflet-container/);
});
