
;(function($, window, document) {

  var pluginName = 'stellar',
      defaults = {
        'scrollProperty': 'scroll',
        'positionProperty': 'position',
        'horizontalScrolling': true,
        'verticalScrolling': true,
        'horizontalOffset': 0,
        'verticalOffset': 0,
        'responsive': false,
        'parallaxBackgrounds': true,
        'parallaxElements': true,
        'hideDistantElements': true,
        'hideElement': function(elem) { elem.style.display = 'none'; },
        'showElement': function(elem) { elem.style.display = 'block'; }
      },

      scrollProperty = {
        'scroll': {
          'getLeft': function(elem) { return elem.pageXOffset; }, // return $elem.scrollLeft();
          'setLeft': function(elem, val) { elem.pageXOffset = val; }, // $elem.scrollLeft(val);

          'getTop': function(elem) { return elem.pageYOffset; }, // return $elem.scrollTop();
          'setTop': function(elem, val) { elem.pageYOffset = val; } // $elem.scrollTop(val);
        },
        'position': {
          'getLeft': function(elem) { return parseInt(elem.style.left, 10) * -1; },
          'getTop': function(elem) { return parseInt(elem.style.top, 10) * -1; }
        },
        'margin': {
          'getLeft': function(elem) { return parseInt(elem.style.marginLeft, 10) * -1; },
          'getTop': function(elem) { return parseInt(elem.style.marginTop, 10) * -1; }
        },
        'transform': {
          'getLeft': function(elem) {
            var computedTransform = getComputedStyle(elem)[prefixedTransform];
            return (computedTransform !== 'none' ? parseInt(computedTransform.match(/(-?[0-9]+)/g)[4], 10) * -1 : 0);
          },
          'getTop': function(elem) {
            var computedTransform = getComputedStyle(elem)[prefixedTransform];
            return (computedTransform !== 'none' ? parseInt(computedTransform.match(/(-?[0-9]+)/g)[5], 10) * -1 : 0);
          }
        }
      },

      positionProperty = {
        'position': {
          'setLeft': function(elem, left) {elem.style.left = parseFloat(left) + 'px'; },
          'setTop': function(elem, top) { elem.style.top = parseFloat(top) + 'px'; }
        },
        'transform': {
          'setPosition': function(elem, left, startingLeft, top, startingTop) {
            elem.style[prefixedTransform] = 'translate3d(' + (left - startingLeft) + 'px, ' + (top - startingTop) + 'px, 0)';
          }
        }
      },

      supportsBackgroundPositionXY,

      prefix = (function() {
        var regex = /^(Webkit|Khtml|Moz|ms|O)(?=[A-Z])/,
            styleDeclaration = document.getElementsByTagName('script')[0].style,
            prop;

        styleDeclaration.background = '#fff';

        for (prop in styleDeclaration) {
          if (regex.test(prop)) {
            return '-' + prop.match(regex)[0].toLowerCase() + '-';
          }
        }

        supportsBackgroundPositionXY = styleDeclaration['background-position-x'] !== undefined;

        // Nothing found so far? Webkit does not enumerate over the CSS properties of the style object.
        // However (prop in style) returns the correct value, so we'll have to test for
        // the precence of a specific property
        if ('WebkitOpacity' in styleDeclaration) { return '-webkit-'; }
        if ('KhtmlOpacity' in styleDeclaration) { return '-khtml-'; }

        return '';
      }()),

      prefixedTransform = prefix + 'transform',

      setBackgroundPosition = (supportsBackgroundPositionXY ?
        function(elem, x, y) {
          elem.style['background-position-x'] = x;
          elem.style['background-position-y'] = y;
        } :
        function(elem, x, y) {
          elem.style['background-position'] = x + ' ' + y;
        }
      ),

      getBackgroundPosition = (supportsBackgroundPositionXY ?
        function(elem) {
          return [
            elem.style['background-position-x'],
            elem.style['background-position-y']
          ];
        } :
        function(elem) {
          return elem.style['background-position'].split(' ');
        }
      ),

      requestAnimFrame = (function () {
        return window.requestAnimationFrame ||
          window.webkitRequestAnimationFrame ||
          function (callback) {
            window.setTimeout(callback, 1000 / 60);
          };
      }());


  function extend(dest) {
    var sources = [].slice.call(arguments, 1),
        i = 0,
        len = sources.length,
        source,
        prop;

    for (i; len > i; i += 1) {
      source = sources[i];

      for (prop in source) {
        if (source[prop] !== undefined) {
          dest[prop] = source[prop];
        }
      }
    }

    return dest;
  };

  function Plugin(element, options) {
    options = options || {};
    this.options = extend({}, defaults);
    extend(this.options, options);

    this.element = element;
    this._defaults = defaults;
    this._name = pluginName;
    this.init();
  }

  Plugin.prototype = {
    init: function() {
      this.options.name = pluginName + '_' + Math.floor(Math.random() * 1e9);

      this._defineElements();
      this._defineGetters();
      this._defineSetters();
      this._handleWindowLoadAndResize();
      this._detectViewport();

      this.refresh({ 'firstLoad': true });

      if (this.options.scrollProperty === 'scroll') {
        this._handleScrollEvent();
      } else {
        this._startAnimationLoop();
      }
    },
    _defineElements: function() {
      if (this.element === document.body) { this.element = window; }
      this.$scrollElement = $(this.element);
      this.$element = (this.element === window ? $('body') : this.$scrollElement);
      this.$viewportElement = (this.options.viewportElement !== undefined ? $(this.options.viewportElement) : (this.$scrollElement[0] === window || this.options.scrollProperty === 'scroll' ? this.$scrollElement : this.$scrollElement.parent()) );
    },
    _defineGetters: function() {
      var self = this,
        scrollPropertyAdapter = scrollProperty[self.options.scrollProperty];

      this._getScrollLeft = function() {
        return scrollPropertyAdapter.getLeft(self.element);
      };

      this._getScrollTop = function() {
        return scrollPropertyAdapter.getTop(self.element);
      };
    },
    _defineSetters: function() {
      var self = this,
        scrollPropertyAdapter = scrollProperty[self.options.scrollProperty],
        positionPropertyAdapter = positionProperty[self.options.positionProperty],
        setScrollLeft = scrollPropertyAdapter.setLeft,
        setScrollTop = scrollPropertyAdapter.setTop;

      this._setScrollLeft = (typeof setScrollLeft === 'function' ? function(val) {
        setScrollLeft(self.element, val);
      } : $.noop);

      this._setScrollTop = (typeof setScrollTop === 'function' ? function(val) {
        setScrollTop(self.element, val);
      } : $.noop);

      this._setPosition = positionPropertyAdapter.setPosition ||
        function(elem, left, startingLeft, top, startingTop) {
          if (self.options.horizontalScrolling) {
            positionPropertyAdapter.setLeft(elem, left, startingLeft);
          }

          if (self.options.verticalScrolling) {
            positionPropertyAdapter.setTop(elem, top, startingTop);
          }
        };
    },
    _handleWindowLoadAndResize: function() {
      var self = this,
        $window = $(window);

      if (self.options.responsive) {
        $window.bind('load.' + this.name, function() {
          self.refresh();
        });
      }

      $window.bind('resize.' + this.name, function() {
        self._detectViewport();

        if (self.options.responsive) {
          self.refresh();
        }
      });
    },
    refresh: function(options) {
      var self = this,
        oldLeft = self._getScrollLeft(),
        oldTop = self._getScrollTop();

      if (!options || !options.firstLoad) {
        this._reset();
      }

      this._setScrollLeft(0);
      this._setScrollTop(0);

      this._setOffsets();
      this._findParticles();
      this._findBackgrounds();

      // Fix for WebKit background rendering bug
      if (options && options.firstLoad && /WebKit/.test(navigator.userAgent)) {
        $(window).load(function() {
          var oldLeft = self._getScrollLeft(),
            oldTop = self._getScrollTop();

          self._setScrollLeft(oldLeft + 1);
          self._setScrollTop(oldTop + 1);

          self._setScrollLeft(oldLeft);
          self._setScrollTop(oldTop);
        });
      }

      this._setScrollLeft(oldLeft);
      this._setScrollTop(oldTop);
    },
    _detectViewport: function() {
      var viewportOffsets = this.$viewportElement.offset(),
          hasOffsets = viewportOffsets !== null && viewportOffsets !== undefined;

      this.viewportWidth = this.$viewportElement.width();
      this.viewportHeight = this.$viewportElement.height();

      this.viewportOffsetTop = (hasOffsets ? viewportOffsets.top : 0);
      this.viewportOffsetLeft = (hasOffsets ? viewportOffsets.left : 0);
    },
    _findParticles: function() {
      var self = this,
        scrollLeft = this._getScrollLeft(),
        scrollTop = this._getScrollTop();

      if (this.particles !== undefined) {
        for (var i = this.particles.length - 1; i >= 0; i--) {
          this.particles[i].$element.data('stellar-elementIsActive', undefined);
        }
      }

      this.particles = [];

      if (!this.options.parallaxElements) return;

      this.$element.find('[data-stellar-ratio]').each(function(i) {
        var $this = $(this),
          horizontalOffset,
          verticalOffset,
          positionLeft,
          positionTop,
          marginLeft,
          marginTop,
          $offsetParent,
          offsetLeft,
          offsetTop,
          parentOffsetLeft = 0,
          parentOffsetTop = 0,
          tempParentOffsetLeft = 0,
          tempParentOffsetTop = 0;

        // Ensure this element isn't already part of another scrolling element
        if (!$this.data('stellar-elementIsActive')) {
          $this.data('stellar-elementIsActive', this);
        } else if ($this.data('stellar-elementIsActive') !== this) {
          return;
        }

        self.options.showElement(this);

        // Save/restore the original top and left CSS values in case we refresh the particles or destroy the instance
        if (!$this.data('stellar-startingLeft')) {
          $this.data('stellar-startingLeft', $this.css('left'));
          $this.data('stellar-startingTop', $this.css('top'));
        } else {
          $this.css('left', $this.data('stellar-startingLeft'));
          $this.css('top', $this.data('stellar-startingTop'));
        }

        positionLeft = $this.position().left;
        positionTop = $this.position().top;

        // Catch-all for margin top/left properties (these evaluate to 'auto' in IE7 and IE8)
        marginLeft = ($this.css('margin-left') === 'auto') ? 0 : parseInt($this.css('margin-left'), 10);
        marginTop = ($this.css('margin-top') === 'auto') ? 0 : parseInt($this.css('margin-top'), 10);

        offsetLeft = $this.offset().left - marginLeft;
        offsetTop = $this.offset().top - marginTop;

        // Calculate the offset parent
        $this.parents().each(function() {
          var $this = $(this);

          if ($this.data('stellar-offset-parent') === true) {
            parentOffsetLeft = tempParentOffsetLeft;
            parentOffsetTop = tempParentOffsetTop;
            $offsetParent = $this;

            return false;
          } else {
            tempParentOffsetLeft += $this.position().left;
            tempParentOffsetTop += $this.position().top;
          }
        });

        // Detect the offsets
        horizontalOffset = ($this.data('stellar-horizontal-offset') !== undefined ? $this.data('stellar-horizontal-offset') : ($offsetParent !== undefined && $offsetParent.data('stellar-horizontal-offset') !== undefined ? $offsetParent.data('stellar-horizontal-offset') : self.horizontalOffset));
        verticalOffset = ($this.data('stellar-vertical-offset') !== undefined ? $this.data('stellar-vertical-offset') : ($offsetParent !== undefined && $offsetParent.data('stellar-vertical-offset') !== undefined ? $offsetParent.data('stellar-vertical-offset') : self.verticalOffset));

        // Add our object to the particles collection
        self.particles.push({
          $element: $this,
          $offsetParent: $offsetParent,
          isFixed: $this.css('position') === 'fixed',
          horizontalOffset: horizontalOffset,
          verticalOffset: verticalOffset,
          startingPositionLeft: positionLeft,
          startingPositionTop: positionTop,
          startingOffsetLeft: offsetLeft,
          startingOffsetTop: offsetTop,
          parentOffsetLeft: parentOffsetLeft,
          parentOffsetTop: parentOffsetTop,
          stellarRatio: ($this.data('stellar-ratio') !== undefined ? $this.data('stellar-ratio') : 1),
          width: $this.outerWidth(true),
          height: $this.outerHeight(true),
          isHidden: false
        });
      });
    },
    _findBackgrounds: function() {
      var self = this,
        scrollLeft = this._getScrollLeft(),
        scrollTop = this._getScrollTop(),
        $backgroundElements;

      this.backgrounds = [];

      if (!this.options.parallaxBackgrounds) return;

      $backgroundElements = this.$element.find('[data-stellar-background-ratio]');

      if (this.$element.data('stellar-background-ratio')) {
                $backgroundElements = $backgroundElements.add(this.$element);
      }

      $backgroundElements.each(function() {
        var $this = $(this),
          backgroundPosition = getBackgroundPosition(this),
          horizontalOffset,
          verticalOffset,
          positionLeft,
          positionTop,
          marginLeft,
          marginTop,
          offsetLeft,
          offsetTop,
          $offsetParent,
          parentOffsetLeft = 0,
          parentOffsetTop = 0,
          tempParentOffsetLeft = 0,
          tempParentOffsetTop = 0;

        // Ensure this element isn't already part of another scrolling element
        if (!$this.data('stellar-backgroundIsActive')) {
          $this.data('stellar-backgroundIsActive', this);
        } else if ($this.data('stellar-backgroundIsActive') !== this) {
          return;
        }

        // Save/restore the original top and left CSS values in case we destroy the instance
        if (!$this.data('stellar-backgroundStartingLeft')) {
          $this.data('stellar-backgroundStartingLeft', backgroundPosition[0]);
          $this.data('stellar-backgroundStartingTop', backgroundPosition[1]);
        } else {
          setBackgroundPosition(this, $this.data('stellar-backgroundStartingLeft'), $this.data('stellar-backgroundStartingTop'));
        }

        // Catch-all for margin top/left properties (these evaluate to 'auto' in IE7 and IE8)
        marginLeft = ($this.css('margin-left') === 'auto') ? 0 : parseInt($this.css('margin-left'), 10);
        marginTop = ($this.css('margin-top') === 'auto') ? 0 : parseInt($this.css('margin-top'), 10);

        offsetLeft = $this.offset().left - marginLeft - scrollLeft;
        offsetTop = $this.offset().top - marginTop - scrollTop;

        // Calculate the offset parent
        $this.parents().each(function() {
          var $this = $(this);

          if ($this.data('stellar-offset-parent') === true) {
            parentOffsetLeft = tempParentOffsetLeft;
            parentOffsetTop = tempParentOffsetTop;
            $offsetParent = $this;

            return false;
          } else {
            tempParentOffsetLeft += $this.position().left;
            tempParentOffsetTop += $this.position().top;
          }
        });

        // Detect the offsets
        horizontalOffset = ($this.data('stellar-horizontal-offset') !== undefined ? $this.data('stellar-horizontal-offset') : ($offsetParent !== undefined && $offsetParent.data('stellar-horizontal-offset') !== undefined ? $offsetParent.data('stellar-horizontal-offset') : self.horizontalOffset));
        verticalOffset = ($this.data('stellar-vertical-offset') !== undefined ? $this.data('stellar-vertical-offset') : ($offsetParent !== undefined && $offsetParent.data('stellar-vertical-offset') !== undefined ? $offsetParent.data('stellar-vertical-offset') : self.verticalOffset));

        self.backgrounds.push({
          $element: $this,
          $offsetParent: $offsetParent,
          isFixed: $this.css('background-attachment') === 'fixed',
          horizontalOffset: horizontalOffset,
          verticalOffset: verticalOffset,
          startingValueLeft: backgroundPosition[0],
          startingValueTop: backgroundPosition[1],
          startingBackgroundPositionLeft: (isNaN(parseInt(backgroundPosition[0], 10)) ? 0 : parseInt(backgroundPosition[0], 10)),
          startingBackgroundPositionTop: (isNaN(parseInt(backgroundPosition[1], 10)) ? 0 : parseInt(backgroundPosition[1], 10)),
          startingPositionLeft: $this.position().left,
          startingPositionTop: $this.position().top,
          startingOffsetLeft: offsetLeft,
          startingOffsetTop: offsetTop,
          parentOffsetLeft: parentOffsetLeft,
          parentOffsetTop: parentOffsetTop,
          stellarRatio: ($this.data('stellar-background-ratio') === undefined ? 1 : $this.data('stellar-background-ratio'))
        });
      });
    },
    _reset: function() {
      var particle,
        startingPositionLeft,
        startingPositionTop,
        background,
        i;

      for (i = this.particles.length - 1; i >= 0; i--) {
        particle = this.particles[i];
        startingPositionLeft = particle.$element.data('stellar-startingLeft');
        startingPositionTop = particle.$element.data('stellar-startingTop');

        this._setPosition(particle.$element[0], startingPositionLeft, startingPositionLeft, startingPositionTop, startingPositionTop);

        this.options.showElement(particle.$element[0]);

        particle.$element.data('stellar-startingLeft', null).data('stellar-elementIsActive', null).data('stellar-backgroundIsActive', null);
      }

      for (i = this.backgrounds.length - 1; i >= 0; i--) {
        background = this.backgrounds[i];

        background.$element.data('stellar-backgroundStartingLeft', null).data('stellar-backgroundStartingTop', null);

        setBackgroundPosition(background.$element[0], background.startingValueLeft, background.startingValueTop);
      }
    },
    destroy: function() {
      this._reset();

      this.$scrollElement.unbind('resize.' + this.name).unbind('scroll.' + this.name);
      this._animationLoop = $.noop;

      $(window).unbind('load.' + this.name).unbind('resize.' + this.name);
    },
    _setOffsets: function() {
      var self = this,
        $window = $(window);

      $window.unbind('resize.horizontal-' + this.name).unbind('resize.vertical-' + this.name);

      if (typeof this.options.horizontalOffset === 'function') {
        this.horizontalOffset = this.options.horizontalOffset();
        $window.bind('resize.horizontal-' + this.name, function() {
          self.horizontalOffset = self.options.horizontalOffset();
        });
      } else {
        this.horizontalOffset = this.options.horizontalOffset;
      }

      if (typeof this.options.verticalOffset === 'function') {
        this.verticalOffset = this.options.verticalOffset();
        $window.bind('resize.vertical-' + this.name, function() {
          self.verticalOffset = self.options.verticalOffset();
        });
      } else {
        this.verticalOffset = this.options.verticalOffset;
      }
    },
    _repositionElements: function() {
      var scrollLeft = this._getScrollLeft(),
        scrollTop = this._getScrollTop(),
        horizontalOffset,
        verticalOffset,
        particle,
        fixedRatioOffset,
        background,
        bgLeft,
        bgTop,
        isVisibleVertical = true,
        isVisibleHorizontal = true,
        newPositionLeft,
        newPositionTop,
        newOffsetLeft,
        newOffsetTop,
        i;

      // First check that the scroll position or container size has changed
      if (this.currentScrollLeft === scrollLeft && this.currentScrollTop === scrollTop && this.currentWidth === this.viewportWidth && this.currentHeight === this.viewportHeight) {
        return;
      } else {
        this.currentScrollLeft = scrollLeft;
        this.currentScrollTop = scrollTop;
        this.currentWidth = this.viewportWidth;
        this.currentHeight = this.viewportHeight;
      }

      // Reposition elements
      for (i = this.particles.length - 1; i >= 0; i--) {
        particle = this.particles[i];

        fixedRatioOffset = (particle.isFixed ? 1 : 0);

        // Calculate position, then calculate what the particle's new offset will be (for visibility check)
        if (this.options.horizontalScrolling) {
          newPositionLeft = (scrollLeft + particle.horizontalOffset + this.viewportOffsetLeft + particle.startingPositionLeft - particle.startingOffsetLeft + particle.parentOffsetLeft) * -(particle.stellarRatio + fixedRatioOffset - 1) + particle.startingPositionLeft;
          newOffsetLeft = newPositionLeft - particle.startingPositionLeft + particle.startingOffsetLeft;
        } else {
          newPositionLeft = particle.startingPositionLeft;
          newOffsetLeft = particle.startingOffsetLeft;
        }

        if (this.options.verticalScrolling) {
          newPositionTop = (scrollTop + particle.verticalOffset + this.viewportOffsetTop + particle.startingPositionTop - particle.startingOffsetTop + particle.parentOffsetTop) * -(particle.stellarRatio + fixedRatioOffset - 1) + particle.startingPositionTop;
          newOffsetTop = newPositionTop - particle.startingPositionTop + particle.startingOffsetTop;
        } else {
          newPositionTop = particle.startingPositionTop;
          newOffsetTop = particle.startingOffsetTop;
        }

        // Check visibility
        if (this.options.hideDistantElements) {
          isVisibleHorizontal = !this.options.horizontalScrolling || newOffsetLeft + particle.width > (particle.isFixed ? 0 : scrollLeft) && newOffsetLeft < (particle.isFixed ? 0 : scrollLeft) + this.viewportWidth + this.viewportOffsetLeft;
          isVisibleVertical = !this.options.verticalScrolling || newOffsetTop + particle.height > (particle.isFixed ? 0 : scrollTop) && newOffsetTop < (particle.isFixed ? 0 : scrollTop) + this.viewportHeight + this.viewportOffsetTop;
        }

        if (isVisibleHorizontal && isVisibleVertical) {
          if (particle.isHidden) {
            this.options.showElement(particle.$element);
            particle.isHidden = false;
          }

          this._setPosition(particle.$element[0], newPositionLeft, particle.startingPositionLeft, newPositionTop, particle.startingPositionTop);
        } else {
          if (!particle.isHidden) {
            this.options.hideElement(particle.$element[0]);
            particle.isHidden = true;
          }
        }
      }

      // Reposition backgrounds
      for (i = this.backgrounds.length - 1; i >= 0; i--) {
        background = this.backgrounds[i];

        fixedRatioOffset = (background.isFixed ? 0 : 1);
        bgLeft = (this.options.horizontalScrolling ? (scrollLeft + background.horizontalOffset - this.viewportOffsetLeft - background.startingOffsetLeft + background.parentOffsetLeft - background.startingBackgroundPositionLeft) * (fixedRatioOffset - background.stellarRatio) + 'px' : background.startingValueLeft);
        bgTop = (this.options.verticalScrolling ? (scrollTop + background.verticalOffset - this.viewportOffsetTop - background.startingOffsetTop + background.parentOffsetTop - background.startingBackgroundPositionTop) * (fixedRatioOffset - background.stellarRatio) + 'px' : background.startingValueTop);

        setBackgroundPosition(background.$element[0], bgLeft, bgTop);
      }
    },
    _handleScrollEvent: function() {
      var self = this,
        ticking = false;

      var update = function() {
        self._repositionElements();
        ticking = false;
      };

      var requestTick = function() {
        if (!ticking) {
          requestAnimFrame(update);
          ticking = true;
        }
      };

      this.$scrollElement.bind('scroll.' + this.name, requestTick);
      requestTick();
    },
    _startAnimationLoop: function() {
      var self = this;

      this._animationLoop = function() {
        requestAnimFrame(self._animationLoop);
        self._repositionElements();
      };
      this._animationLoop();
    }
  };

  $.fn[pluginName] = function (options) {
    var args = arguments;
    if (options === undefined || typeof options === 'object') {
      return this.each(function () {
        if (!$.data(this, 'plugin_' + pluginName)) {
          $.data(this, 'plugin_' + pluginName, new Plugin(this, options));
        }
      });
    } else if (typeof options === 'string' && options[0] !== '_' && options !== 'init') {
      return this.each(function () {
        var instance = $.data(this, 'plugin_' + pluginName);
        if (instance instanceof Plugin && typeof instance[options] === 'function') {
          instance[options].apply(instance, Array.prototype.slice.call(args, 1));
        }
        if (options === 'destroy') {
          $.data(this, 'plugin_' + pluginName, null);
        }
      });
    }
  };

  $[pluginName] = function(options) {
    var $window = $(window);
    return $window.stellar.apply($window, Array.prototype.slice.call(arguments, 0));
  };

  // Expose the scroll and position property function hashes so they can be extended
  $[pluginName].scrollProperty = scrollProperty;
  $[pluginName].positionProperty = positionProperty;

  // Expose the plugin class so it can be modified
  window.Stellar = Plugin;

}(jQuery, this, document));
