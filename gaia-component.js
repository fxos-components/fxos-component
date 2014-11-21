;(function(define){define(function(require,exports,module){
'use strict';

var noop  = function() {};

/**
 * Detects presence of shadow-dom
 * CSS selectors.
 *
 * @return {Boolean}
 */
var hasShadowCSS = (function() {
  try { document.querySelector(':host'); return true; }
  catch (e) { return false; }
})();

module.exports.register = function(name, props) {
  var proto = mixin(Object.create(base), props);
  var output = extractLightDomCSS(proto.template, name);

  proto.template =  output.template;
  proto.lightCSS =  output.lightCSS;

  // Register and return the constructor
  // and expose `protoype` (bug 1048339)
  var El = document.registerElement(name, { prototype: proto });
  El.prototype = proto;
  return El;
};

var base = mixin(Object.create(HTMLElement.prototype), {
  attributeChanged: noop,
  attached: noop,
  detached: noop,
  created: noop,
  template: '',

  createdCallback: function() {
    this.injectLightCSS(this);
    this.created();
  },

  attributeChangedCallback: function(name, from, to) {
    this.attributeChanged(name, from, to);
  },

  attachedCallback: function() {
    this.attached();
  },

  detachedCallback: function() {
    this.detached();
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
  injectLightCSS: function(el) {
    if (hasShadowCSS) { return; }
    var style = document.createElement('style');
    style.setAttribute('scoped', '');
    style.innerHTML = el.lightCSS;
    el.appendChild(style);
  }
});

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
  var lightCSS = '';

  if (!hasShadowCSS) {
    template = template.replace(regex, function(match) {
      lightCSS += match.replace(/::content|:host/g, name);
      return '';
    });
  }

  return {
    template: template,
    lightCSS: lightCSS
  };
}

function mixin(a, b) {
  for (var key in b) { a[key] = b[key]; }
  return a;
}

});})(typeof define=='function'&&define.amd?define
:(function(n,w){'use strict';return typeof module=='object'?function(c){
c(require,exports,module);}:function(c){var m={exports:{}};c(function(n){
return w[n];},m.exports,m);w[n]=m.exports;};})('gaia-component',this));