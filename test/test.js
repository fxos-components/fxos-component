/*global window,assert,suite,setup,teardown,sinon,test*/
/*jshint esnext:true*/

suite('gaia-component', function() {
  'use strict';

  var component = window['gaia-component'];

  setup(function() {
    this.sinon = sinon.sandbox.create();
    this.sinon.spy(document.head, 'appendChild');
    this.Component = register();
  });

  teardown(function() {
    this.sinon.restore();
  });

  test('It turns the template string into a <template> element', function() {
    assert.isTrue(this.Component.prototype.template instanceof HTMLTemplateElement);
  });

  test('It defines attrs decriptors to enable get/set functionality', function() {
    var component = new this.Component();

    assert.isTrue('value' in component);
    assert.equal(component.value, undefined);

    component.value = 'foo';
    assert.equal(component.value, 'foo_stored');
  });

  test('It calls attrs setter when matching attribute changes', function() {
    var component = new this.Component();

    component.setAttribute('value', 'foo');
    assert.equal(component.value, 'foo_stored');
  });

  test('It discards the `attrs` key from the proto', function() {
    assert.isUndefined(this.Component.prototype.attrs);
  });

  test('It extracts unsupported shadow-dom css selectors', function() {
    var templateHTML = this.Component.prototype.template.innerHTML;
    var regex = /(?::host|::content)[^{]*\{[^}]*\}/g;
    var matches = regex.exec(templateHTML);
    assert.isNull(matches, 'no shadow-css found');
  });

  test('It injects the shadow-css into the light-dom (shim)', function() {
    var component = new this.Component();
    var tagName = component.tagName.toLowerCase();
    var lightCSS = component.querySelector('style').innerHTML;
    var expected = `${tagName} { display: block }${tagName} h1 { color: blue }`;

    assert.equal(lightCSS, expected);
  });

  test('It puts global-css in the <head>', function() {
    var style = document.head.appendChild.args[0][0];
    assert.equal(style.innerHTML, '@keyframes my-animation {}');
  });

  test('It doesnt putt `globalCss` on the prototype', function() {
    assert.isUndefined(this.Component.prototype.globalCss);
  });

  test('setting textContent doesnt remove light-dom css', function() {
    var component = new this.Component();
    component.textContent = 'foo';
    var style = component.querySelector('style');
    assert.isDefined(style);
  });

  test('removeAttr() and setAttr() also set attrs on first shadow-dom child', function() {
    var component = new this.Component();
    var inner = component.shadowRoot.firstElementChild;

    component.setAttr('foo', 'foo');

    assert.equal(component.getAttribute('foo'), 'foo');
    assert.equal(inner.getAttribute('foo'), 'foo');
  });

  test('Shortcut callbacks should be called as normal', function() {
    var proto = this.Component.prototype;

    sinon.spy(proto, 'created');
    sinon.spy(proto, 'attributeChanged');
    sinon.spy(proto, 'attached');
    sinon.spy(proto, 'detached');

    var component = new this.Component();
    sinon.assert.called(proto.created);

    document.body.appendChild(component);
    sinon.assert.called(proto.attached);

    document.body.removeChild(component);
    sinon.assert.called(proto.detached);

    component.setAttribute('foo', 'foo');
    sinon.assert.called(proto.attributeChanged);
  });

  /**
   * Utils
   */

  var i = 0;

  function register() {
    return component.register('component-' + i++, {
      created: function() {
        this.setupShadowRoot();
      },

      attributeChanged: function() {},
      attached: function() {},
      detached: function() {},

      template: `
        <div class="inner"></div>
        <style>
          .inner { color: red }
          ::host { display: block }
          ::content h1 { color: blue }
        </style>
      `,

      globalCss: `
        @keyframes my-animation {}
      `,

      attrs: {
        value: {
          get: function() { return this._value; },
          set: function(value) { this._value = value + '_stored'; },
        }
      }
    });
  }
});
