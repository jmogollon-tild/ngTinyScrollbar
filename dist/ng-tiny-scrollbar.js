/*!
Copyright 2014 Vadim Kazakov
Adapted from source by Maarten Baijs

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
"Software"), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.
THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

 */

'use strict';

angular.module('ngTinyScrollbar', ['ngAnimate'])
    .directive('scrollbar', function($window, $animate, $timeout, $parse) {
        return {
            restrict: 'A',
            transclude: true,
            template: '<div class="scroll-bar"><div class="scroll-track"><div class="scroll-thumb"><div class="scroll-end"></div></div></div></div><div class="scroll-viewport"><div class="scroll-overview" ng-transclude></div></div>',
            controller: function($scope, $element, $attrs) {

                var defaults = {
                    axis : 'y', // Vertical or horizontal scrollbar? ( x || y ).
                    wheel : true, // Enable or disable the mousewheel;
                    wheelSpeed : 40, // How many pixels must the mouswheel scroll at a time.
                    wheelLock : true, // Lock default scrolling window when there is no more content.
                    scrollInvert : false, // Enable invert style scrolling
                    trackSize : false, // Set the size of the scrollbar to auto or a fixed number.
                    thumbSize : false, // Set the size of the thumb to auto or a fixed number.
                    alwaysVisible: true // Set to false to hide the scrollbar if not being used
                };
                var options = $attrs.scrollbar;
                if (options) {
                    options = $parse(options)($scope);
                } else {
                    options = {};
                }
                this.options = angular.extend({}, defaults, options);
                this._defaults = defaults;

                var self = this,
                    $body = angular.element(document.querySelectorAll('body')[0]),
                    $document = angular.element(document),
                    $viewport = angular.element($element[0].querySelectorAll('.scroll-viewport')[0]),
                    $overview = angular.element($element[0].querySelectorAll('.scroll-overview')[0]),
                    $scrollbar = angular.element($element[0].querySelectorAll('.scroll-bar')[0]),
                    $track = angular.element($element[0].querySelectorAll('.scroll-track')[0]),
                    $thumb = angular.element($element[0].querySelectorAll('.scroll-thumb')[0]),
                    mousePosition = 0,
                    isHorizontal = this.options.axis === 'x',
                    hasTouchEvents = ('ontouchstart' in document.documentElement),
                    wheelEvent = ('onwheel' in document || document.documentMode >= 9) ? 'wheel' :
                        (document.onmousewheel !== undefined ? 'mousewheel' : 'DOMMouseScroll'),
                    sizeLabel = isHorizontal ? 'width' : 'height',
                    posiLabel = isHorizontal ? 'left' : 'top',
                    moveEvent = document.createEvent('HTMLEvents'),
                    restoreVisibilityAfterWheel;

                moveEvent.initEvent('move', true, true);
                this.contentPosition = 0;
                this.viewportSize = 0;
                this.contentSize = 0;
                this.contentRatio = 0;
                this.trackSize = 0;
                this.trackRatio = 0;
                this.thumbSize = 0;
                this.thumbPosition = 0;

                this.initialize = function() {
                    if (!this.options.alwaysVisible) {
                        $scrollbar.css('opacity', 0);
                    }
                    self.update();
                    setEvents();
                    return self;
                };

                this.update = function(scrollTo)
                {
                    var sizeLabelCap = sizeLabel.charAt(0).toUpperCase() + sizeLabel.slice(1).toLowerCase();
                    this.viewportSize = $viewport[0]['offset'+ sizeLabelCap];
                    this.contentSize = $overview[0]['scroll'+ sizeLabelCap];
                    this.contentRatio = this.viewportSize / this.contentSize;
                    this.trackSize = this.options.trackSize || this.viewportSize;
                    this.thumbSize = Math.min(this.trackSize, Math.max(0, (this.options.thumbSize || (this.trackSize * this.contentRatio))));
                    this.trackRatio = this.options.thumbSize ? (this.contentSize - this.viewportSize) / (this.trackSize - this.thumbSize) : (this.contentSize / this.trackSize);
                    mousePosition = $track[0].offsetTop;

                    $scrollbar.toggleClass('disable', this.contentRatio >= 1);

                    if (this.contentRatio > 1) {
                        return this;
                    }

                    if (!this.options.alwaysVisible) {
                        //flash the scrollbar when update happens
                        $animate.addClass($scrollbar[0], 'visible', function() {
                            $animate.removeClass($scrollbar[0], 'visible');
                        });
                    }
                    switch (scrollTo) {
                        case 'bottom':
                            this.contentPosition = this.contentSize - this.viewportSize;
                            break;
                        case 'relative':
                            this.contentPosition = Math.min(this.contentSize - this.viewportSize, Math.max(0, this.contentPosition));
                            break;
                        default:
                            this.contentPosition = parseInt(scrollTo, 10) || 0;
                    }
                    setSize();
                    return this;
                };

                function setSize() {
                    $thumb.css(posiLabel, self.contentPosition / self.trackRatio + 'px');
                    $overview.css(posiLabel, -self.contentPosition + 'px');
                    $scrollbar.css(sizeLabel, self.trackSize + 'px');
                    $track.css(sizeLabel, self.trackSize + 'px');
                    $thumb.css(sizeLabel, self.thumbSize + 'px');
                }

                function setEvents() {

                    if(hasTouchEvents) {
                        $viewport.on('touchstart', touchstart);
                    }
                    else {
                        $thumb.on('mousedown', start);
                        $track.on('mousedown', drag);
                    }

                    angular.element($window).on('resize', resize);

                    if(self.options.wheel) {
                        $element.on(wheelEvent, wheel);
                    }
                }

                function resize() {
                    self.update('relative');
                }

                function touchstart(event) {
                    if (1 === event.touches.length) {
                        event.stopPropagation();
                        start(event.touches[0]);
                    }
                }

                function start(event) {
                    $body.addClass('scroll-no-select');
                    $element.addClass('scroll-no-select');

                    if (!self.options.alwaysVisible) {
                        $animate.addClass($scrollbar[0], 'visible');
                    }
                    mousePosition = isHorizontal ? event.pageX : event.pageY;
                    self.thumbPosition = parseInt($thumb.css(posiLabel), 10) || 0;

                    if(hasTouchEvents) {
                        $document.on('touchmove', touchdrag);
                        $document.on('touchend', end);
                    } else {
                        $document.on('mousemove', drag);
                        $document.on('mouseup', end);
                        $thumb.on('mouseup', end);
                    }
                }

                function wheel(event) {

                    if(self.contentRatio >= 1) {
                        return;
                    }

                    if (!self.options.alwaysVisible) {
                        //cancel removing visibility if wheel event is triggered before the timeout
                        if (restoreVisibilityAfterWheel) {
                            $timeout.cancel(restoreVisibilityAfterWheel);
                        }
                        $animate.addClass($scrollbar[0], 'visible');

                        restoreVisibilityAfterWheel = $timeout(function() {
                            $animate.removeClass($scrollbar[0], 'visible');
                        }, 100);
                    }


                    var evntObj = event || window.event,
                        deltaDir = 'delta' + self.options.axis.toUpperCase(),
                        wheelSpeedDelta = -(evntObj[deltaDir] || evntObj.detail || (-1 / 3 * evntObj.wheelDelta)) / 40;

                    self.contentPosition -= wheelSpeedDelta * self.options.wheelSpeed;
                    self.contentPosition = Math.min((self.contentSize - self.viewportSize), Math.max(0, self.contentPosition));

                    $element[0].dispatchEvent(moveEvent);

                    $thumb.css(posiLabel, self.contentPosition / self.trackRatio + 'px');
                    $overview.css(posiLabel, -self.contentPosition + 'px');

                    if(self.options.wheelLock || (self.contentPosition !== (self.contentSize - self.viewportSize) && self.contentPosition !== 0)) {
                        evntObj.preventDefault();
                    }
                }

                function touchdrag(event) {
                    event.preventDefault();
                    drag(event.touches[0]);
                }

                function drag(event) {

                    if(self.contentRatio >= 1) {
                        return;
                    }

                    var mousePositionNew = isHorizontal ? event.pageX : event.pageY,
                        thumbPositionDelta = mousePositionNew - mousePosition;

                    if(self.options.scrollInvert && hasTouchEvents)
                    {
                        thumbPositionDelta = mousePosition - mousePositionNew;
                    }
                    var thumbPositionNew = Math.min((self.trackSize - self.thumbSize), Math.max(0, self.thumbPosition + thumbPositionDelta));
                    self.contentPosition = thumbPositionNew * self.trackRatio;

                    $element[0].dispatchEvent(moveEvent);

                    $thumb.css(posiLabel, thumbPositionNew + 'px');
                    $overview.css(posiLabel, -self.contentPosition + 'px');
                }

                function end() {

                    $body.removeClass('scroll-no-select');
                    $element.removeClass('scroll-no-select');
                    if (!self.options.alwaysVisible) {
                        $animate.removeClass($scrollbar[0], 'visible');
                    }

                    $document.off('mousemove', drag);
                    $document.off('mouseup', end);
                    $thumb.off('mouseup', end);
                    $document.off('touchmove', touchdrag);
                    $document.off('ontouchend', end);
                }

                this.cleanup = function() {
                    $viewport.off('touchstart', touchstart);
                    $thumb.off('mousedown', start);
                    $track.off('mousedown', drag);
                    angular.element($window).off('resize', resize);
                    $element.off(wheelEvent, wheel);
                    end();
                };

            },
            link: function(scope, iElement, iAttrs, controller) {
                iElement.css('position', 'relative');
                controller.initialize();
                iElement.on('$destroy', function() {
                    controller.cleanup();
                });
            }
        };
    });