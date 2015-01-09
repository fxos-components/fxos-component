;(function(define){define(function(require,exports,module){
'use strict';

/**
 * Locals
 */

var textContent = Object.getOwnPropertyDescriptor(Node.prototype, 'textContent');
var removeAttribute = HTMLElement.prototype.removeAttribute;
var setAttribute = HTMLElement.prototype.setAttribute;
var noop  = function() {};

/**
 * Detects presence of shadow-dom
 * CSS selectors.
 *
 * @return {Boolean}
 */
var hasShadowCSS = (function() {
  var div = document.createElement('div');
  try { div.querySelector(':host'); return true; }
  catch (e) { return false; }
})();

/**
 * Register a new component.
 *
 * @param  {String} name
 * @param  {Object} props
 * @return {constructor}
 * @public
 */
module.exports.register = function(name, props) {

  // Inject global CSS into the document,
  // and delete as no longer needed
  injectGlobalCss(props.globalCss);
  delete props.globalCss;

  // Decide on a base protoype, create a handy
  // reference to super (extended) class, then clean up.
  var parent = props.extends ? props.extends.prototype : base;
  props.super = parent;
  delete props.extends;

  // Merge base getter/setter attributes with the user's,
  // then define the property descriptors on the prototype.
  var descriptors = Object.assign(props.attrs || {}, baseAttrs);

  // Store the orginal descriptors somewhere
  // a little more private and delete the original
  props._attrs = props.attrs;
  delete props.attrs;

  // Create the prototype, extended from the parent
  var proto = Object.assign(Object.create(parent), props);

  // Define the properties directly on the prototype
  Object.defineProperties(proto, descriptors);

  // Pull out CSS that needs to be in the light-dom
  var output = extractLightDomCSS(proto.template, name);
  proto.template = document.createElement('template');
  proto.template.innerHTML = output.template;
  proto.lightCss = output.lightCss;

  // Register the custom-element and return the constructor
  return document.registerElement(name, { prototype: proto });
};

var base = Object.assign(Object.create(HTMLElement.prototype), {
  attributeChanged: noop,
  attached: noop,
  detached: noop,
  created: noop,
  template: '',

  createdCallback: function() {
    this.injectLightCss(this);
    this.created();
  },

  /**
   * It is very common to want to keep object
   * properties in-sync with attributes,
   * for example:
   *
   *   el.value = 'foo';
   *   el.setAttribute('value', 'foo');
   *
   * So we support an object on the prototype
   * named 'attrs' to provide a consistent
   * way for component authors to define
   * these properties. When an attribute
   * changes we keep the attr[name]
   * up-to-date.
   *
   * @param  {String} name
   * @param  {String||null} from
   * @param  {String||null} to
   */
  attributeChangedCallback: function(name, from, to) {
    var prop = toCamelCase(name);
    if (this._attrs && this._attrs[prop]) { this[prop] = to; }
    this.attributeChanged(name, from, to);
  },

  attachedCallback: function() { this.attached(); },
  detachedCallback: function() { this.detached(); },

  /**
   * A convenient method for setting up
   * a shadow-root using the defined template.
   *
   * @return {ShadowRoot}
   */
  setupShadowRoot: function() {
    var node = document.importNode(this.template.content, true);
    this.createShadowRoot().appendChild(node);
    return this.shadowRoot;
  },

  /**
   * Sets an attribute internally
   * and externally. This is so that
   * we can style internal shadow-dom
   * content.
   *
   * @param {String} name
   * @param {String} value
   */
  setAttr: function(name, value) {
    var internal = this.shadowRoot.firstElementChild;
    setAttribute.call(internal, name, value);
    setAttribute.call(this, name, value);
  },

  /**
   * Removes an attribute internally
   * and externally. This is so that
   * we can style internal shadow-dom
   * content.
   *
   * @param {String} name
   * @param {String} value
   */
  removeAttr: function(name) {
    var internal = this.shadowRoot.firstElementChild;
    removeAttribute.call(internal, name);
    removeAttribute.call(this, name);
  },

  /**
   * The Gecko platform doesn't yet have
   * `::content` or `:host`, selectors,
   * without these we are unable to style
   * user-content in the light-dom from
   * within our shadow-dom style-sheet.
   *
   * To workaround this, we clone the <style>
   * node into the root of the component,
   * so our selectors are able to target
   * light-dom content.
   *
   * @private
   */
  injectLightCss: function(el) {
    if (hasShadowCSS) { return; }
    this.lightStyle = document.createElement('style');
    this.lightStyle.setAttribute('scoped', '');
    this.lightStyle.innerHTML = el.lightCss;
    el.appendChild(this.lightStyle);
  }
});

var baseAttrs = {
  textContent: {
    set: function(value) {
      var node = firstChildTextNode(this);
      if (node) { node.nodeValue = value; }
    },

    get: function() {
      var node = firstChildTextNode(this);
      return node && node.nodeValue;
    }
  }
};

/**
 * Return the first child textNode.
 *
 * @param  {Element} el
 * @return {TextNode}
 */
function firstChildTextNode(el) {
  for (var i = 0; i < el.childNodes.length; i++) {
    var node = el.childNodes[i];
    if (node && node.nodeType === 3) { return node; }
  }
}

/**
 * Extracts the :host and ::content rules
 * from the shadow-dom CSS and rewrites
 * them to work from the <style scoped>
 * injected at the root of the component.
 *
 * @return {String}
 */
function extractLightDomCSS(template, name) {
  var regex = /(?::host|::content)[^{]*\{[^}]*\}/g;
  var lightCss = '';

  if (!hasShadowCSS) {
    template = template.replace(regex, function(match) {
      lightCss += match.replace(/::content|:host/g, name);
      return '';
    });
  }

  return {
    template: template,
    lightCss: lightCss
  };
}

/**
 * Some CSS rules, such as @keyframes
 * and @font-face don't work inside
 * scoped or shadow <style>. So we
 * have to put them into 'global'
 * <style> in the head of the
 * document.
 *
 * @param  {String} css
 */
function injectGlobalCss(css) {
  if (!css) return;
  var style = document.createElement('style');
  style.innerHTML = css.trim();
  document.head.appendChild(style);
}

/**
 * Convert hyphen separated
 * string to camel-case.
 *
 * Example:
 *
 *   toCamelCase('foo-bar'); //=> 'fooBar'
 *
 * @param  {Sring} string
 * @return {String}
 */
function toCamelCase(string) {
  return string.replace(/-(.)/g, function replacer(string, p1) {
    return p1.toUpperCase();
  });
}

});})(typeof define=='function'&&define.amd?define
:(function(n,w){'use strict';return typeof module=='object'?function(c){
c(require,exports,module);}:function(c){var m={exports:{}};c(function(n){
return w[n];},m.exports,m);w[n]=m.exports;};})('gaia-component',this));
