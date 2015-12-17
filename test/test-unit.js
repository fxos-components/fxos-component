/*global sinon, assert, suite, setup, teardown, test, HTMLTemplateElement,
  suiteSetup */
suite('fxos-component', function() {

  var component = window.fxosComponent;

  setup(function() {
    this.sinon = sinon.sandbox.create();
    this.Component = register();
  });

  teardown(function() {
    this.sinon.restore();
  });

  test('It turns the template string into a <template> element', function() {
    assert.isTrue(this.Component.prototype.template instanceof
      HTMLTemplateElement);
  });

  test('It defines attrs decriptors to enable get/set functionality',
    function() {
    var component = new this.Component();

    assert.isTrue('value' in component);
    assert.equal(component.value, undefined);

    component.value = 'foo';
    assert.equal(component.value, 'foo_stored');
  });

  test('It calls attrs setter when matching attribute changes',
    function() {
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

  test('It rewrites shadow-css selectors correctly', function() {
    var Element = component.register('host-style-test', {
      template: `<style>
          :host { display: block; }
          :host([foo]) { color: red; }
          :host([foo]) :-moz-dir(rtl) { color: red; }
          :host([foo]) ::content .bar { color: red; }
          ::content h1 { color: red; }
        </style>
      `
    });

    var el = new Element();
    var lightCSS = el.querySelector('style').innerHTML;

    assert.include(lightCSS, 'host-style-test { display: block; }');
    assert.include(lightCSS, 'host-style-test[foo] { color: red; }');
    assert.include(lightCSS, 'host-style-test[foo] :-moz-dir(rtl) { color: red; }');
    assert.include(lightCSS, 'host-style-test[foo] .bar { color: red; }');
    assert.include(lightCSS, 'host-style-test h1 { color: red; }');
  });

  test('It extracts :host-context() selectors into globalCss and rewrites them',
    function(done) {
    this.sinon.stub(document.head, 'appendChild');
    var Element = component.register('host-context-test', {
      template: `<style>
          :host-context(.foo) ::content h1 { display: block; }
          :host-context([dir=rtl]) { dir: rtl; }
          :host-context([foo]) h1:-moz-dir(rtl) { color: red; }
          :host(.foo) { color: red; }
          ::content h1 { color: red; }
        </style>`
    });

    var el = new Element();
    setTimeout(function() {
      var lightCSS = el.querySelector('style').innerHTML;
      var globalStyle = document.head.appendChild.args[0][0];

      assert.equal(globalStyle.innerHTML,
        '.foo host-context-test h1 { display: block; }' +
        '[dir=rtl] host-context-test { dir: rtl; }' +
        '[foo] host-context-test h1:-moz-dir(rtl) { color: red; }');
      assert.equal(lightCSS,
        'host-context-test.foo { color: red; }' +
        'host-context-test h1 { color: red; }');
      done();
    });
  });

  test('It injects the shadow-css into the light-dom (shim)', function() {
    var component = new this.Component();
    var tagName = component.tagName.toLowerCase();
    var lightCSS = component.querySelector('style').innerHTML;
    var expected = `${tagName} { display: block }${tagName} h1 { color: blue }`;

    assert.equal(lightCSS, expected);
  });

  test('it does not inject a <style> if one is already present', function() {
    var component = new this.Component();
    var cloned = component.cloneNode(true);
    var stylesheets = cloned.querySelectorAll('style');

    assert.equal(stylesheets.length, 1);
  });

  test('It puts global-css in the <head>', function(done) {
    this.sinon.stub(document.head, 'appendChild');

    component.register('global-css-test', {
      globalCss: '@keyframes my-animation {}'
    });

    setTimeout(function() {
      var style = document.head.appendChild.args[0][0];
      assert.equal(style.innerHTML, '@keyframes my-animation {}');
      done();
    });
  });

  test('It doesnt putt `globalCss` on the prototype', function() {
    assert.isUndefined(this.Component.prototype.globalCss);
  });

  test('setting textContent doesn\'t remove light-dom CSS', function() {
    var component = new this.Component();
    component.textContent = 'foo';
    var style = component.querySelector('style');
    assert.ok(style);
  });

  test('setting innerHTML doesn\'t remove light-dom CSS', function() {
    var component = new this.Component();
    component.innerHTML = 'foo';
    var style = component.querySelector('style');
    assert.ok(style);
  });

  test('removeAttr() and setAttr() also set attrs on first shadow-dom child',
    function() {
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

  suite('extends', function() {
    test('it can extend from a native prototype', function() {
      var El = component.register('test-extend-native',
        {extends: HTMLInputElement});
      var el = new El();

      assert.isTrue(el instanceof HTMLInputElement);
    });

    test('extending from a native prototype still includes base properties',
      function() {
      var El = component.register('test-extend-base-props',
        {extends: HTMLInputElement});
      assert.isDefined(El.prototype.createdCallback);
    });

    test('it can extend from existing FXOSComponent', function() {
      var Parent = component.register('test-extends-parent', { foo: true });
      var Child = component.register('test-extends-child', { extends: Parent });

      assert.isTrue(Child.prototype.foo);
    });

    test('it defaults to HTMLElementPrototype', function() {
      var el = new this.Component();
      assert.ok(el instanceof HTMLElement);
    });

    test('it stores the template string by default', function() {
      var El = component.register('test-extends-template-string', {
        extends: HTMLInputElement,
        template: `<div class="inner"></div>`
      });
      assert.ok(El.prototype.templateString);
    });

    test('it does not store the template string if the' +
         'component is declared as non extensible', function() {
      var El = component.register('test-extends-non-extensible', {
        extends: HTMLInputElement,
        extensible: false,
        template: `<div class="inner"></div>`
      });
      assert.isUndefined(El.prototype.templateString);
    });

    test('a child inherits parent style template', function() {
      var Parent = component.register('test-extensible-parent', {
        extends: HTMLInputElement,
        template: `
          <div class="inner"></div>
          <style>::host { display: block; background-color: pink; } </style>
        `
      });
      var Child = component.register('test-extensible-child', {
        extends: Parent.prototype
      });
      var el = new Child();
      var lightCSS = el.querySelector('style').innerHTML;
      assert.isTrue(!!~lightCSS.indexOf(
        'test-extensible-child { display: block; background-color: pink; }'));
    });
  });

  suite('rtl', function() {
    setup(function() {
      this.dir = document.dir;
    });

    teardown(function() {
      document.dir = this.dir;
    });

    test('component can listen for rtl changes', function(done) {
      var El = component.register('rtl-test', {
        dirObserver: true,

        created: function() {
          this.dirChanged = this.dirChanged.bind(this);
          document.addEventListener('dirchanged', this.dirChanged);
        },

        dirChanged: function() {
          assert.equal(document.dir, 'rtl');
          document.removeEventListener('dirchanged', this.dirChanged);
          done();
        }
      });

      El();
      document.dir = 'rtl';
    });
  });

  suite('l10n', function() {
    var MockL10n = {
      translateFragment: sinon.spy(),
      ready: Promise.resolve()
    };
    var Element = component.register('component-l10n', {
      attached: function() { this.setupShadowL10n(); }
    });
    var dom, el, addEventListenerSpy, removeEventListenerSpy;

    suiteSetup(function() {
      addEventListenerSpy = sinon.spy(document, 'addEventListener');
      removeEventListenerSpy = sinon.spy(document, 'removeEventListener');
    });

    setup(function() {
      document.l10n = MockL10n;
      dom = document.createElement('div');
      document.body.appendChild(dom);
      el = new Element();
    });

    teardown(function() {
      addEventListenerSpy.reset();
      removeEventListenerSpy.reset();
      document.body.removeChild(dom);
      dom = null;
    });

    test('localization should be supported if document.l10n is present',
      function(done) {
        assert.ok(document.l10n);
        assert.notOk(el.onDOMRetranslated);
        dom.appendChild(el);

        assert.ok(el.onDOMRetranslated);
        document.l10n.ready.then(function() {
          sinon.assert.calledWith(document.addEventListener, 'DOMRetranslated',
            el.onDOMRetranslated);
          sinon.assert.calledWith(MockL10n.translateFragment, el.shadowRoot);
          el.remove();
          document.l10n.ready.then(function() {
            sinon.assert.calledWith(document.removeEventListener,
              'DOMRetranslated', el.onDOMRetranslated);
            done();
          });
        });
      });

    test('localization should be skipped if document.l10n is not present',
      function() {
        // Clear l10n.
        document.l10n = null;
        sinon.spy(el, 'localizeShadow');

        assert.notOk(el.onDOMRetranslated);
        dom.appendChild(el);

        sinon.assert.calledWith(el.localizeShadow, el.shadowRoot);
        assert.notOk(el.onDOMRetranslated);
      });
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

      attrs: {
        value: {
          get: function() { return this._value; },
          set: function(value) { this._value = value + '_stored'; },
        }
      }
    });
  }

});
