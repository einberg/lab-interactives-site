/*global define: false, $: false */
// ------------------------------------------------------------
//
//   Semantic Layout
//
// ------------------------------------------------------------

define(function (require) {

  var labConfig = require('lab.config'),
      alert     = require('common/alert'),

      // Minimum width of the model.
      minModelWidth = 150,

      containerColors = [
        "rgba(0,0,255,0.1)", "rgba(255,0,0,0.1)", "rgba(0,255,0,0.1)", "rgba(255,255,0,0.1)",
        "rgba(0,255,255,0.1)", "rgba(255,255,128,0.1)", "rgba(128,255,0,0.1)", "rgba(255,128,0,0.1)"
      ];

  return function SemanticLayout($interactiveContainer, containers, componentLocations, components, modelController) {

    var layout,
        $modelContainer,
        $containers,

        modelWidth = minModelWidth,
        modelTop = 0,
        modelLeft = 0,

        availableWidth,
        availableHeight,

        // Canonical dimensions of the interactive, deciding about font size.
        basicInteractiveWidth = 500,
        basicInteractiveHeight = 350,

        interactiveAspectRatio;

    function getDimensionOfContainer($container, dim) {
      var position = $container.position();

      switch (dim) {
        case "top":
          return position.top;
        case "bottom":
          return position.top + $container.outerHeight();
        case "left":
          return position.left;
        case "right":
          return position.left + $container.outerWidth();
        case "height":
          return $container.outerHeight();
        case "width":
          return $container.outerWidth();
      }
    }

    function setFontSize() {
      var containerAspectRatio = availableWidth / availableHeight,
          scale;

      if (interactiveAspectRatio <= containerAspectRatio) {
        scale = availableHeight / basicInteractiveHeight;
      } else {
        scale = availableWidth / basicInteractiveWidth;
      }

      // Ensure min font size.
      if (scale < 0.65) {
        scale = 0.65;
      }

      // Set font-size of #responsive-content element. So, if application author
      // wants to avoid rescaling of font-size for some elements, they should not
      // be included in #responsive-content DIV.
      // TODO: #responsive-content ID is hardcoded, change it?
      $("#responsive-content").css("font-size", scale + "em");
    }

    // Calculate width for containers which doesn't explicitly specify its width.
    // In such case, width is determined by the content, no reflow will be allowed.
    function setMinDimensions() {
      var maxMinWidth, $container, i, len;

      function setRowMinWidth() {
        var minWidth = 0;
        // $(this) refers to one row.
        $(this).children().each(function () {
          // $(this) refers to element in row.
          minWidth += $(this).outerWidth(true);
        });
        $(this).css("min-width", Math.ceil(minWidth));
        if (minWidth > maxMinWidth) {
          maxMinWidth = minWidth;
        }
      }

      for (i = 0, len = containers.length; i < len; i++) {
        $container = $containers[containers[i].id];
        if (containers[i].width === undefined) {
          // Set min-width only for containers, which DO NOT specify
          // "width" explicitly in their definitions.
          maxMinWidth = -Infinity;
          $container.css("min-width", 0);
          $container.children().each(setRowMinWidth);
          $container.css("min-width", maxMinWidth);
        }
        if (containers[i]["min-width"] !== undefined) {
          $container.css("min-width", containers[i]["min-width"]);
        }
      }
    }

    function setupBackground() {
      var id, i, len;

      for (i = 0, len = containers.length; i < len; i++) {
        id = containers[i].id;
        $containers[id].css("background", labConfig.authoring ? containerColors[i % containerColors.length] : "");
      }
    }

    function createContainers() {
      var container, id, prop, i, ii;

      $containers = {};

      $modelContainer = $interactiveContainer.find("#model-container");
      $modelContainer.css("position", "absolute");
      $containers.model = $modelContainer;

      for (i = 0, ii = containers.length; i < ii; i++) {
        container = containers[i];
        id = container.id;
        $containers[id] = $("<div id='" + id + "'>").appendTo($interactiveContainer);
        $containers[id].css({
          "display": "inline-block",
          "position": "absolute"
        });

        for (prop in container) {
          if (!container.hasOwnProperty(prop)) continue;
          // Add any padding-* properties directly to the container's style.
          if (/^padding-/.test(prop)) {
            $containers[id].css(prop, container[prop]);
          }
          // Support also "align" property.
          if (prop === "align") {
            $containers[id].css("text-align", container[prop]);
          }
        }
      }
    }

    function placeComponentsInContainers() {
      var id, container, divContents, items, $row,
          lastContainer, $rows, comps,
          i, ii, j, jj, k, kk;

      comps = $.extend({}, components);

      for (i = 0, ii = containers.length; i<ii; i++) {
        container = containers[i];
        if (componentLocations) {
          divContents = componentLocations[container.id];
        }
        if (!divContents) continue;

        if (Object.prototype.toString.call(divContents[0]) !== "[object Array]") {
          divContents = [divContents];
        }

        for (j = 0, jj = divContents.length; j < jj; j++) {
          items = divContents[j];
          $row = $('<div class="interactive-' + container.id + '-row"/>');
          // Each row should have width 100% of its parent container.
          $row.css("width", "100%");
          // When there is only one row, ensure that it fills whole container.
          if (jj === 1) {
            $row.css("height", "100%");
          }
          $containers[container.id].append($row);
          for (k = 0, kk = items.length; k < kk; k++) {
            id = items[k];
            if (comps[id] !== undefined) {
              $row.append(comps[id].getViewContainer());
              delete comps[id];
            } else {
              alert("Incorrect layout definition. Component with ID '" + id + "'' is not defined.");
            }
          }
        }
      }

      // add any remaining components to "bottom" or last container
      lastContainer = getObject(containers, "bottom") || containers[containers.length-1];
      for (id in comps) {
        if (!comps.hasOwnProperty(id)) continue;
        $rows = $containers[lastContainer.id].children();
        $row = $rows.last();
        if (!$row.length) {
          $row = $('<div class="interactive-' + container.id + '-row"/>');
          $containers[container.id].append($row);
        }
        $row.append(comps[id].getViewContainer());
      }
    }

    function positionContainers() {
      var container, $container,
          left, top, right, bottom, i, ii;

      $modelContainer.css({
        width:  modelWidth,
        height: modelController.getHeightForWidth(modelWidth),
        left:   modelLeft,
        top:    modelTop
      });

      for (i = 0, ii = containers.length; i<ii; i++) {
        container = containers[i];
        $container = $containers[container.id];

        if (!container.left && !container.right) {
          container.left = "0";
        }
        if (!container.top && !container.bottom) {
          container.top = "0";
        }

        if (container.left) {
          left = parseDimension(container.left);
          $container.css("left", left);
        }
        if (container.top) {
          top = parseDimension(container.top);
          $container.css("top", top);
        }
        if (container.height) {
          $container.css("height", parseDimension(container.height));
        }
        if (container.width) {
          $container.css("width", parseDimension(container.width));
        }
        if (container.right) {
          right = parseDimension(container.right);
          left = right - $container.outerWidth();
          $container.css("left", left);
        }
        if (container.bottom) {
          bottom = parseDimension(container.bottom);
          top = bottom - $container.outerHeight();
          $container.css("top", top);
        }
      }
    }

    // shrinks the model to fit in the interactive, given the sizes
    // of the other containers around it.
    function resizeModelContainer() {
      var maxX = -Infinity,
          maxY = -Infinity,
          minX = Infinity,
          minY = Infinity,
          id, $container,
          right, bottom, top, left, ratio;

      // Calculate boundaries of the interactive.
      for (id in $containers) {
        if (!$containers.hasOwnProperty(id)) continue;
        $container = $containers[id];
        right = getDimensionOfContainer($container, "right");
        if (right > maxX) {
          maxX = right;
        }
        bottom = getDimensionOfContainer($container, "bottom");
        if (bottom > maxY) {
          maxY = bottom;
        }
        left = getDimensionOfContainer($container, "left");
        if (left < minX) {
          minX = left;
        }
        top = getDimensionOfContainer($container, "top");
        if (top < minY) {
          minY = top;
        }
      }

      // TODO: this is quite naive approach.
      // It should be changed to some fitness function defining quality of the layout.
      // Using current algorithm, very often we follow some local minima.
      if ((maxX <= availableWidth && maxY <= availableHeight) &&
          (availableWidth - maxX < 1 || availableHeight - maxY < 1) &&
          (minX < 1 && minY < 1)) {
        // Perfect solution found!
        // (TODO: not so perfect, see above)
        return true;
      }

      ratio = Math.min(availableWidth / maxX, availableHeight / maxY);
      if (!isNaN(ratio)) {
        modelWidth = modelWidth * ratio;
      }
      if (modelWidth < minModelWidth) {
        modelWidth = minModelWidth;
      }

      modelLeft -= minX;
      modelTop -= minY;

      return false;
    }

    // parses arithmetic such as "model.height/2"
    function parseDimension(dim) {
      var vars, i, ii, value;

      if (typeof dim === "number" || /^[0-9]+(em)?$/.test(dim)) {
        return dim;
      }

      // find all strings of the form x.y
      vars = dim.match(/[a-zA-Z\-]+\.[a-zA-Z]+/g);

      // replace all x.y's with the actual dimension
      for (i=0, ii=vars.length; i<ii; i++) {
        value = getDimension(vars[i]);
        dim = dim.replace(vars[i], value);
      }
      // eval only if we contain no more alphabetic letters
      if (/^[^a-zA-Z]*$/.test(dim)) {
        return eval(dim);
      } else {
        return 0;
      }
    }

    // Parses a container's dimension, such as "model.height".
    function getDimension(dim) {
      switch(dim) {
        case "interactive.width":
          return availableWidth;
        case "interactive.height":
          return availableHeight;
        default:
          dim = dim.split(".");
          return getDimensionOfContainer($containers[dim[0]], dim[1]);
      }
    }

    function getObject(arr, id) {
      for (var i = 0, ii = arr.length; i<ii; i++) {
        if (arr[i].id === id) {
          return arr[i];
        }
      }
    }

    function calcInteractiveAspectRatio() {
      var redraws = 0,
          maxX = -Infinity,
          maxY = -Infinity,
          id, $container, val;

      availableWidth = basicInteractiveWidth;
      availableHeight = basicInteractiveHeight;
      setMinDimensions();
      modelWidth = availableWidth;
      positionContainers();
      while (redraws < 15 && !resizeModelContainer()) {
        positionContainers();
        redraws++;
      }

      for (id in $containers) {
        if (!$containers.hasOwnProperty(id)) continue;
        $container = $containers[id];
        val = getDimensionOfContainer($container, "right");
        if (val > maxX) {
          maxX = val;
        }
        val = getDimensionOfContainer($container, "bottom");
        if (val > maxY) {
          maxY = val;
        }
      }

      interactiveAspectRatio = maxX / maxY;
      if (interactiveAspectRatio < (availableWidth / availableHeight)) {
        basicInteractiveWidth = basicInteractiveHeight * interactiveAspectRatio;
      } else {
        basicInteractiveHeight = basicInteractiveWidth / interactiveAspectRatio;
      }


      console.log(basicInteractiveWidth + " x " + basicInteractiveHeight);
    }

    // Public API.
    layout = {
      layoutInteractive: function () {
        var redraws = 0,
            id;

        availableWidth  = $interactiveContainer.width();
        availableHeight = $interactiveContainer.height();

        // 0. Set font size of the interactive-container based on its size.
        setFontSize();

        // 1. Calculate dimensions of containers which don't specify explicitly define it.
        //    It's necessary to do it each time, as when size of the container is changed,
        //    also size of the components can be changed (e.g. due to new font size).
        setMinDimensions();

        // 2. Calculate optimal layout.
        modelWidth = availableWidth;
        positionContainers();
        while (redraws < 35 && !resizeModelContainer()) {
          positionContainers();
          redraws++;
        }

        // 3. Notify components that their containers have new sizes.
        modelController.resize();
        for (id in components) {
          if (components.hasOwnProperty(id) && components[id].resize !== undefined) {
            components[id].resize();
          }
        }

        // 4. Set / remove colors of containers depending on the value of Lab.config.authoring
        setupBackground();
      }
    };

    //
    // Initialize.
    //
    createContainers();
    placeComponentsInContainers();
    calcInteractiveAspectRatio();

    return layout;
  };

});