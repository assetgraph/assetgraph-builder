(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.juneInvestmentProjectionGraph = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
module.exports = {
  colors: {
    // COLORS
    PrimaryBlue: '#372988',
    DarkerBlue: '#372489',
    SecondaryGreen: '#00CC7E',
    NegativeRed: '#E94C4C',

    ColdBlack: '#2F2A4D',
    Titanium: '#747188',
    LightGray: '#E3E3E7',
    AlmostWhite: '#F5F5F9',
    ReallyWhite: '#FFF',
    AltWhite:'#F2F2F6',
    SnowWhite: '#FCFCFC',
    LightBlue: '#391F8C',
    DarkBlue: '#30284F',

    // GRADIENTS
    DiagonalGradient: 'linear-gradient(-134deg, #272759 0%, #3D2A99 100%)',
    GradientNightSkyBackground: 'linear-gradient(to bottom, #272759, #3D2A99)',
    SignupGradient: 'linear-gradient(148deg, #59274F 0%, #3D2A99 100%)'
  }
};

},{}],2:[function(require,module,exports){
var d3 = require('d3');

if (typeof d3.select === 'undefined') {
  d3 = window.d3;
}

var colors = require('./constants').colors;
var element;
var svg;
var margins;

function tickIncrementWithScaleMax(scaleMax) {
  if (scaleMax > 2000000) { return 500000; }
  if (scaleMax > 1000000) { return 250000; }
  if (scaleMax > 400000) { return 100000; }
  if (scaleMax > 200000) { return 50000; }
  if (scaleMax > 100000) { return 50000; }
  if (scaleMax > 50000) { return 20000; }
  if (scaleMax > 25000) { return 10000; }
  if (scaleMax > 10000) { return 5000; }
  if (scaleMax > 5000) { return 1000; }
  if (scaleMax > 2000) { return 500; }
  if (scaleMax > 1000) { return 250; }
  if (scaleMax > 500) { return 100; }
  return 100;
}

function createGraph(node, timeHorizonInYears, maxYValue) {
  timeHorizonInYears = Number(timeHorizonInYears);

  if (isNaN(timeHorizonInYears)) {
    throw new Error('timeHorizonInYears must be a number');
  }

  element = d3.select(node);
  var width = element[0][0].clientWidth;
  var height = element[0][0].clientHeight;
  margins = {
      top: 0,
      right: 10,
      bottom: 40,
      left: 10
    };

  var xScale = d3.scale.linear().range([margins.left, width - margins.left - margins.right]).domain([0, 1]);
  var yScale = d3.scale.linear().range([height - margins.top - margins.bottom, 0]).domain([0, maxYValue]);

  svg = element.append('svg')
    .attr('width', width)
    .attr('height', height);

  var defs = svg.append('defs');

  defs.append('clipPath')
    .attr('id', 'clippingPath')
    .append('rect')
    .attr('id', 'clippingRect')
    .attr('x', xScale(0))
    .attr('width', xScale(1) - xScale(0))
    .attr('y', 0)
    .attr('height', height);

  defs.append('clipPath')
    .attr('id', 'yearsClippingPath')
    .append('rect')
    .attr('id', 'clippingRect')
    .attr('x', xScale(0) - margins.left)
    .attr('width', xScale(1) - xScale(0) + margins.left + 15)
    .attr('y', 0)
    .attr('height', height);


  defs.append('pattern')
    .attr('id', 'stripedGray')
    .attr('patternUnits', 'userSpaceOnUse')
    .attr('width', 4)
    .attr('height', 4)
    .append('path')
    .attr('d', 'M-1,1 l2,-2 M0,4 l4,-4 M3,5 l2,-2')
    .attr('stroke', colors.LightGray)
    .attr('stroke-width', 1);

  svg.append('g')
    .attr('clip-path', 'url(#yearsClippingPath)')
    .attr('id', 'yearsHolder');

  svg.append('path')
    .attr('class', 'area')
    .attr('clip-path', 'url(#clippingPath)')
    .attr('fill', 'url(#stripedGray)');

  svg.append('path')
    .attr('class', 'investedLine')
    .attr('stroke', colors.Titanium)
    .attr('stroke-width', 2)
    .style('stroke-dasharray', '4,4')
    .attr('clip-path', 'url(#clippingPath)')
    .attr('fill', 'transparent');

  svg.append('path')
    .attr('class', 'maxLine')
    .attr('stroke', colors.SecondaryGreen)
    .attr('stroke-width', 3)
    .attr('clip-path', 'url(#clippingPath)')
    .attr('fill', 'none');

  svg.append('path')
    .attr('class', 'averageLine')
    .attr('stroke', colors.PrimaryBlue)
    .attr('stroke-width', 3)
    .attr('clip-path', 'url(#clippingPath)')
    .attr('fill', 'none');

  svg.append('path')
    .attr('class', 'minLine')
    .attr('stroke', colors.NegativeRed)
    .attr('stroke-width', 3)
    .attr('clip-path', 'url(#clippingPath)')
    .attr('fill', 'transparent');

  /*svg.append('text')
    .attr('id', 'graphLabel')
    .classed('maxLabel graphLabel', true)
    .attr('y', yScale(0))
    .attr('x', xScale(1))
    .attr("text-anchor", "start");

  svg.append('text')
    .classed('averageLabel graphLabel', true)
    .attr('y', yScale(0))
    .attr('x', xScale(1))
    .attr("text-anchor", "start");

  svg.append('text')
    .classed('minLabel graphLabel', true)
    .attr('y', yScale(0))
    .attr('x', xScale(1))
    .attr("text-anchor", "start");
*/
  // x axis
  svg.append('rect')
    .attr('class', 'axis')
    .attr('y', yScale(0) - 1)
    .attr('height', 3)
    .attr('x', -1)
    .attr('width', xScale(1) + 2)
    .attr('fill', colors.Titanium)
    .style('stroke', colors.ReallyWhite)
    .style('stroke-width', '1px');
}

var yScaleOld = null;

function updateGraph(data, timeHorizonInYears, maxYValue, animationSpeed) {
  timeHorizonInYears = Number(timeHorizonInYears);

  if (isNaN(timeHorizonInYears)) {
    throw new Error('timeHorizonInYears must be a number');
  }

  var width = element[0][0].clientWidth;
  var height = element[0][0].clientHeight;

  svg.attr('width', width)
    .attr('height', height);

  var xScale = d3.scale.linear().range([margins.left, width - margins.left - margins.right]).domain([0, 1]);

  var yScale = d3.scale.linear().range([height - margins.top - margins.bottom, 0]).domain([0, maxYValue]);
  // var yScaleScalar = d3.scale.linear().range([0, height - margins.top - margins.bottom]).domain([0, maxYValue]);
  // initial condition
  if (yScaleOld == null) {
    yScaleOld = yScale;
  }

  var minPath = d3.svg.line()
    .x(function (d) { return xScale(d.time); })
    .y(function (d) { return yScale(d.min); })
    .interpolate('basis');

  var averagePath = d3.svg.line()
    .x(function (d) { return xScale(d.time); })
    .y(function (d) { return yScale(d.average); })
    .interpolate('basis');

  var maxPath = d3.svg.line()
    .x(function (d) { return xScale(d.time); })
    .y(function (d) { return yScale(d.max); })
    .interpolate('basis');

  var investedPath = d3.svg.line()
    .x(function (d) { return xScale(d.time); })
    .y(function (d) { return yScale(d.invested); })
    .interpolate('basis');

  var area = d3.svg.area()
    .x(function (d) { return xScale(d.time); })
    .y0(function (d) { return yScale(d.min); })
    .y1(function (d) { return yScale(d.max); })
    .interpolate('linear');

  svg.transition()
    .select('.maxLine')
    .duration(animationSpeed)
    .attr('d', maxPath(data));

  svg.transition()
    .select('.averageLine')
    .duration(animationSpeed)
    .attr('d', averagePath(data));

  svg.transition()
    .select('.minLine')
    .duration(animationSpeed)
    .attr('d', minPath(data));

  svg.transition()
    .select('.investedLine')
    .duration(animationSpeed)
    .attr('d', investedPath(data));

  svg.transition()
    .select('.area')
    .duration(animationSpeed)
    .attr('d', area(data));

  svg.transition()
    .select('#clippingRect')
    .attr('x', xScale(0))
    .attr('width', xScale(1) - xScale(0))
    .attr('y', 0)
    .attr('height', height);

  // draw end values
  /*var endDataPoint = data[Math.floor(timeHorizonInYears)];

  svg.transition()
    .select('.maxLabel')
    .duration(animationSpeed)
    .attr('y', yScale(endDataPoint.max))
    .attr('x', xScale(1))
    .text(getFormattedNumber(endDataPoint.max));

  svg.transition()
    .select('.averageLabel')
    .duration(animationSpeed)
    .attr('y', yScale(endDataPoint.average))
    .attr('x', xScale(1))
    .text(getFormattedNumber(endDataPoint.average));

  svg.transition()
    .select('.minLabel')
    .duration(animationSpeed)
    .attr('y', yScale(endDataPoint.min))
    .attr('x', xScale(1))
    .text(getFormattedNumber(endDataPoint.min));
*/
  // draw ticks
  var tickIncrement = tickIncrementWithScaleMax(maxYValue, data[0].amount);

  var tickLabels = [];

  var i = 0;
  while (i < maxYValue) {
    if (i != 0) {
      tickLabels.push({ y: i, label: i.toLocaleString('da', { style: 'currency', currency: 'DKK' }) , value: i});
    }
    i += tickIncrement;
  }

  var ticks = svg.selectAll('.tick').data(tickLabels, function(d, i) { return d.value; });

  ticks.enter()
    .append('text')
    .attr('class', 'tick')
    .attr('x', xScale(1) + 5)
    .attr('fill', colors.Titanium)
    .attr('text-anchor', 'end')
    .text(function (d) { return d.label; })
    .attr('y', function (d) { return yScaleOld(d.y) + 4; })
    .transition()
    .duration(animationSpeed)
    .attr('y', function (d) { return yScale(d.y) + 4; });

  ticks.exit()
    .transition()
    .duration(animationSpeed)
    .attr('y', function (d) { return yScale(d.y) + 4; })
    .attr('opacity', 0)
    .remove();

  ticks.transition()
    .duration(animationSpeed)
    .attr('x', xScale(1) + 5)
    .attr('y', function (d) { return yScale(d.y) + 4; })
    .text(function (d) { return d.label; });

  svg.selectAll('#endLabel')
    .attr('x', xScale(1) - 5)
    .attr('y', yScale(0) + 17)
    .text(new Date().getFullYear() + timeHorizonInYears);

  svg.selectAll('.axis')
    .attr('y', yScale(0) - 1)
    .attr('width', xScale(1) + 2);

  // draw years
  var arrayOfYears = d3.range(timeHorizonInYears + 1);
  var yearLines = svg.select('#yearsHolder').selectAll('.yearLineHolder').data(arrayOfYears);
  var newYearLineHolders = yearLines.enter()
    .append('g')
    .attr('class', 'yearLineHolder')
    .attr('transform', function (d) { return 'translate(' + yearLineTranslationWithIndexAndMaxIndex(timeHorizonInYears, timeHorizonInYears) + ', 0)'; });

  newYearLineHolders.append('line')
    .attr('y1', function (d) { return yScale(0); })
    .attr('y2', function (d) { return yScale(maxYValue); })
    .style('stroke', colors.LightGray)
    .style('stroke-width', 1)
    .attr('x1', 1)
    .attr('x2', 1);
  newYearLineHolders.insert('text')
    .text(function (d) { return d == 0 ? 'I DAG' : new Date().getFullYear() + d; })
    .attr('x', 0)
    .attr('y', function (d) { return yScale(0) + 17; })
    .attr('fill', colors.Titanium)
    .attr('text-anchor', 'middle');

  function yearLineTranslationWithIndexAndMaxIndex(index, maxIndex) {
    var ret = 0;
      ret = xScale(index / timeHorizonInYears);

    return ret;
  }

  yearLines.exit()
    .transition()
    .duration(animationSpeed)
    .attr('transform', function (d) { return 'translate(' + yearLineTranslationWithIndexAndMaxIndex(d, timeHorizonInYears) + ', 0)'; })
    .remove();

  yearLines.transition()
    .duration(animationSpeed)
    .attr('transform', function (d) { return 'translate(' + yearLineTranslationWithIndexAndMaxIndex(d, timeHorizonInYears) + ', 0)'; });

  yScaleOld = yScale;
}

module.exports = {
  init: createGraph,
  update: updateGraph
};

},{"./constants":1,"d3":undefined}],3:[function(require,module,exports){
var projectionData = require('./projectionData');
var graph = require('./graph');
var rippleUpdate = require('./rippleUpdate');

function calculateProjectionData(projectionPercentageData, initialDeposit, monthlyDeposit, timeHorizon) {
  var projection = projectionPercentageData.map(function(dataPoint) {
    var yearlyDeposit = 12 * monthlyDeposit;

    return {
      time: dataPoint.time / Number(timeHorizon),
      min: yearlyDeposit * dataPoint.runningWorst + dataPoint.worst * initialDeposit,
      average: yearlyDeposit * dataPoint.runningExpected + dataPoint.expected * initialDeposit,
      max: yearlyDeposit * dataPoint.runningBest + dataPoint.best * initialDeposit,
      invested: yearlyDeposit * dataPoint.time + initialDeposit
    }
  });

  return projection;
}

function getMaxYAxisValue(data) {
  var highestPossibleReturnProjection = calculateProjectionData(projectionData['opportunity'], data.initialDeposit, data.monthlyDeposit, data.timeHorizon);
  var highestPossibleReturn = highestPossibleReturnProjection[highestPossibleReturnProjection.length - 1].max;

  return highestPossibleReturn + Math.pow(highestPossibleReturn, 0.5) * 100;
}

function ProjectionGraph(options) {
  if (typeof options !== 'object') {
    throw new Error('ProjectionGraph: An object must be supplied as first argument');
  }

  if (!options.element || options.element.nodeType !== 1) {
    throw new Error('ProjectionGraph: options.element must be a DOM Element');
  }

  if (typeof options.data !== 'object') {
    throw new Error('ProjectionGraph: options.data must be a data object')
  }

  var initialState = {
    initialDeposit: options.data.initialDeposit || 10000,
    monthlyDeposit: options.data.monthlyDeposit || 0,
    timeHorizon: options.data.timeHorizon || '15',
    riskProfile: options.data.riskProfile || 'balanced'
  };

  this.element = options.element;
  this.animationSpeed = options.animationSpeed || 500; // Milliseconds

  if (options.rippleUpdateEffect) {
    this.rippleUpdate = rippleUpdate(graph, this.animationSpeed);
  }

  graph.init(this.element, initialState.timeHorizon, getMaxYAxisValue(initialState));

  this.setState(initialState);
}

ProjectionGraph.prototype = {
  setState: function (nextState) {
    var state = Object.assign({}, this.state, nextState);

    var graphData = calculateProjectionData(projectionData[state.riskProfile], state.initialDeposit, state.monthlyDeposit, state.timeHorizon);

    if (this.rippleUpdate) {
      this.rippleUpdate(graphData, state.timeHorizon, getMaxYAxisValue(state));
    } else {
      if (!this.state) {
        graph.update(graphData, state.timeHorizon, getMaxYAxisValue(state), 0);
      } else {
        graph.update(graphData, state.timeHorizon, getMaxYAxisValue(state), this.animationSpeed);
      }
    }

    this.state = state;
  },

  destruct: function  () {
    delete this.element;
  }
}

module.exports = ProjectionGraph;

},{"./graph":2,"./projectionData":4,"./rippleUpdate":5}],4:[function(require,module,exports){
module.exports = {
  balanced: [
    {time: 0, expected: 1, worst: 1, best: 1, runningExpected: 0, runningWorst: 0, runningBest: 0},
    {time: 1, expected: 1.0187, worst: 0.86121, best: 1.15645, runningExpected: 1, runningWorst: 1, runningBest: 1},
    {time: 2, expected: 1.04754, worst: 0.8458, best: 1.24727, runningExpected: 2.03, runningWorst: 1.998, runningBest: 2.004},
    {time: 3, expected: 1.0778, worst: 0.84386, best: 1.31786, runningExpected: 3.092, runningWorst: 2.882, runningBest: 3.168},
    {time: 4, expected: 1.10756, worst: 0.84908, best: 1.38428, runningExpected: 4.178, runningWorst: 4.032, runningBest: 4.502},
    {time: 5, expected: 1.14839, worst: 0.86407, best: 1.44937, runningExpected: 5.336, runningWorst: 4.878, runningBest: 6.266},
    {time: 6, expected: 1.19741, worst: 0.89458, best: 1.54229, runningExpected: 6.57, runningWorst: 6.28, runningBest: 7.936},
    {time: 7, expected: 1.25796, worst: 0.91802, best: 1.63925, runningExpected: 7.91, runningWorst: 6.522, runningBest: 8.436},
    {time: 8, expected: 1.322, worst: 0.93726, best: 1.77748, runningExpected: 9.32, runningWorst: 8.072, runningBest: 10.776},
    {time: 9, expected: 1.39431, worst: 0.99093, best: 1.86611, runningExpected: 10.846, runningWorst: 9.56, runningBest: 12.578},
    {time: 10, expected: 1.46763, worst: 0.99377, best: 2.04111, runningExpected: 12.422, runningWorst: 9.694, runningBest: 14.826},
    {time: 11, expected: 1.55813, worst: 1.06456, best: 2.21981, runningExpected: 14.196, runningWorst: 11.288, runningBest: 18.16},
    {time: 12, expected: 1.64584, worst: 1.11195, best: 2.29534, runningExpected: 16.018, runningWorst: 11.266, runningBest: 19.722},
    {time: 13, expected: 1.73964, worst: 1.12471, best: 2.50788, runningExpected: 17.94, runningWorst: 13.522, runningBest: 20.21},
    {time: 14, expected: 1.83481, worst: 1.18082, best: 2.64148, runningExpected: 19.928, runningWorst: 15.56, runningBest: 22.464},
    {time: 15, expected: 1.92792, worst: 1.21883, best: 2.84387, runningExpected: 21.962, runningWorst: 17.236, runningBest: 27.286},
  ]
,
  moderate: [
    {time: 0, expected: 1, worst: 1, best: 1, runningExpected: 0, runningWorst: 0, runningBest: 0},
    {time: 1, expected: 1.01155844155844, worst: 0.886173826173826, best: 1.11613386613387, runningExpected: 1, runningWorst: 1, runningBest: 1},
    {time: 2, expected: 1.03293706293706, worst: 0.883576423576424, best: 1.16384615384615, runningExpected: 2.022, runningWorst: 1.92, runningBest: 2.082},
    {time: 3, expected: 1.05638361638362, worst: 0.884935064935065, best: 1.21354645354645, runningExpected: 3.07, runningWorst: 2.978, runningBest: 3.196},
    {time: 4, expected: 1.08062937062937, worst: 0.903066933066933, best: 1.25376623376623, runningExpected: 4.142, runningWorst: 3.866, runningBest: 4.266},
    {time: 5, expected: 1.11572427572428, worst: 0.922017982017982, best: 1.30654345654346, runningExpected: 5.28, runningWorst: 4.806, runningBest: 5.676},
    {time: 6, expected: 1.15499500499501, worst: 0.951658341658342, best: 1.38257742257742, runningExpected: 6.472, runningWorst: 6.044, runningBest: 7.036},
    {time: 7, expected: 1.20734265734266, worst: 0.981438561438561, best: 1.45985014985015, runningExpected: 7.768, runningWorst: 7.036, runningBest: 8.368},
    {time: 8, expected: 1.26261738261738, worst: 1.01406593406593, best: 1.56557442557443, runningExpected: 9.128, runningWorst: 8.216, runningBest: 10.248},
    {time: 9, expected: 1.32555444555445, worst: 1.05517482517483, best: 1.65246753246753, runningExpected: 10.592, runningWorst: 9.406, runningBest: 12.058},
    {time: 10, expected: 1.3897002997003, worst: 1.07661338661339, best: 1.76383616383616, runningExpected: 12.108, runningWorst: 10.738, runningBest: 14.06},
    {time: 11, expected: 1.4658041958042, worst: 1.1398001998002, best: 1.8664035964036, runningExpected: 13.776, runningWorst: 11.518, runningBest: 15.75},
    {time: 12, expected: 1.54111888111888, worst: 1.17345654345654, best: 1.98466533466533, runningExpected: 15.494, runningWorst: 12.942, runningBest: 17.326},
    {time: 13, expected: 1.62167832167832, worst: 1.2016983016983, best: 2.10607392607393, runningExpected: 17.308, runningWorst: 14.232, runningBest: 19.924},
    {time: 14, expected: 1.7031968031968, worst: 1.24523476523477, best: 2.23521478521479, runningExpected: 19.18, runningWorst: 16.464, runningBest: 21.72},
    {time: 15, expected: 1.78200799200799, worst: 1.29340659340659, best: 2.37124875124875, runningExpected: 21.078, runningWorst: 17.162, runningBest: 26.246},
  ]
,
  moderateshort: [
    {time: 0, expected: 1, worst: 1, best: 1, runningExpected: 0, runningWorst: 0, runningBest: 0},
    {time: 1, expected: 1.01381, worst: 0.88188, best: 1.13163, runningExpected: 1, runningWorst: 1, runningBest: 1},
    {time: 2, expected: 1.03754, worst: 0.86693, best: 1.193, runningExpected: 2.024, runningWorst: 1.944, runningBest: 2.05},
    {time: 3, expected: 1.06308, worst: 0.86947, best: 1.25171, runningExpected: 3.076, runningWorst: 2.824, runningBest: 3.472},
    {time: 4, expected: 1.08884, worst: 0.88032, best: 1.31286, runningExpected: 4.152, runningWorst: 4.144, runningBest: 4.17},
    {time: 5, expected: 1.12547, worst: 0.89496, best: 1.35704, runningExpected: 5.298, runningWorst: 4.818, runningBest: 5.87},
    {time: 6, expected: 1.16782, worst: 0.92635, best: 1.43351, runningExpected: 6.502, runningWorst: 5.918, runningBest: 7.304},
    {time: 7, expected: 1.22252, worst: 0.95377, best: 1.52342, runningExpected: 7.81, runningWorst: 7.29, runningBest: 8.442},
    {time: 8, expected: 1.28032, worst: 0.97831, best: 1.63377, runningExpected: 9.184, runningWorst: 8.15, runningBest: 10.454},
    {time: 9, expected: 1.34594, worst: 1.02704, best: 1.7234, runningExpected: 10.666, runningWorst: 9.336, runningBest: 11.606},
    {time: 10, expected: 1.41254, worst: 1.03954, best: 1.84717, runningExpected: 12.198, runningWorst: 10.812, runningBest: 14.426},
    {time: 11, expected: 1.49295, worst: 1.10637, best: 1.98025, runningExpected: 13.9, runningWorst: 11.99, runningBest: 16.884},
    {time: 12, expected: 1.57179, worst: 1.1413, best: 2.10275, runningExpected: 15.648, runningWorst: 13.53, runningBest: 18.744},
    {time: 13, expected: 1.65597, worst: 1.1699, best: 2.2329, runningExpected: 17.492, runningWorst: 13.224, runningBest: 19.826},
    {time: 14, expected: 1.74119, worst: 1.20087, best: 2.35251, runningExpected: 19.396, runningWorst: 15.17, runningBest: 23.538},
    {time: 15, expected: 1.8239, worst: 1.25329, best: 2.54866, runningExpected: 21.33, runningWorst: 17.5, runningBest: 26.228},
  ]
,
  opportunity: [
    {time: 0, expected: 1, worst: 1, best: 1, runningExpected: 0, runningWorst: 0, runningBest: 0},
    {time: 1, expected: 1.04333, worst: 0.7136, best: 1.32216, runningExpected: 1, runningWorst: 1, runningBest: 1},
    {time: 2, expected: 1.09814, worst: 0.67846, best: 1.54202, runningExpected: 2.054, runningWorst: 1.69, runningBest: 2.222},
    {time: 3, expected: 1.15127, worst: 0.68299, best: 1.6945, runningExpected: 3.162, runningWorst: 2.696, runningBest: 3.588},
    {time: 4, expected: 1.20088, worst: 0.67176, best: 1.8372, runningExpected: 4.302, runningWorst: 4.046, runningBest: 5.426},
    {time: 5, expected: 1.26316, worst: 0.66245, best: 1.97429, runningExpected: 5.536, runningWorst: 4.374, runningBest: 7.31},
    {time: 6, expected: 1.34659, worst: 0.67585, best: 2.20317, runningExpected: 6.92, runningWorst: 4.936, runningBest: 7.31},
    {time: 7, expected: 1.43729, worst: 0.70143, best: 2.44906, runningExpected: 8.41, runningWorst: 6.552, runningBest: 9.476},
    {time: 8, expected: 1.53213, worst: 0.71446, best: 2.68588, runningExpected: 10.008, runningWorst: 6.02, runningBest: 13.208},
    {time: 9, expected: 1.63661, worst: 0.74515, best: 2.86278, runningExpected: 11.762, runningWorst: 7.788, runningBest: 14.98},
    {time: 10, expected: 1.74515, worst: 0.73772, best: 3.27351, runningExpected: 13.552, runningWorst: 7.782, runningBest: 15.77},
    {time: 11, expected: 1.89179, worst: 0.78926, best: 3.57444, runningExpected: 15.718, runningWorst: 9.744, runningBest: 23.808},
    {time: 12, expected: 2.02325, worst: 0.81394, best: 3.8942, runningExpected: 17.922, runningWorst: 10.656, runningBest: 33.384},
    {time: 13, expected: 2.17046, worst: 0.82754, best: 4.32153, runningExpected: 20.264, runningWorst: 11.976, runningBest: 31.608},
    {time: 14, expected: 2.32107, worst: 0.87594, best: 4.71136, runningExpected: 22.702, runningWorst: 14.282, runningBest: 32.568},
    {time: 15, expected: 2.47028, worst: 0.89211, best: 4.99938, runningExpected: 25.28, runningWorst: 17.766, runningBest: 37.448},
  ]
,
  progressive: [
    {time: 0, expected: 1, worst: 1, best: 1, runningExpected: 0, runningWorst: 0, runningBest: 0},
    {time: 1, expected: 1.02485, worst: 0.82119, best: 1.1905, runningExpected: 1, runningWorst: 1, runningBest: 1},
    {time: 2, expected: 1.06014, worst: 0.81269, best: 1.31843, runningExpected: 2.034, runningWorst: 1.876, runningBest: 2.202},
    {time: 3, expected: 1.09625, worst: 0.80582, best: 1.403, runningExpected: 3.11, runningWorst: 2.872, runningBest: 3.522},
    {time: 4, expected: 1.13101, worst: 0.80315, best: 1.48301, runningExpected: 4.21, runningWorst: 3.368, runningBest: 4.746},
    {time: 5, expected: 1.17715, worst: 0.81596, best: 1.56787, runningExpected: 5.386, runningWorst: 4.49, runningBest: 6.064},
    {time: 6, expected: 1.23464, worst: 0.84874, best: 1.70006, runningExpected: 6.658, runningWorst: 4.926, runningBest: 7.928},
    {time: 7, expected: 1.30263, worst: 0.85371, best: 1.82243, runningExpected: 8.034, runningWorst: 6.684, runningBest: 9.664},
    {time: 8, expected: 1.37449, worst: 0.89308, best: 1.98524, runningExpected: 9.49, runningWorst: 8.028, runningBest: 13.202},
    {time: 9, expected: 1.45513, worst: 0.93775, best: 2.08527, runningExpected: 11.072, runningWorst: 9.788, runningBest: 13.508},
    {time: 10, expected: 1.53706, worst: 0.92522, best: 2.31336, runningExpected: 12.702, runningWorst: 10.018, runningBest: 16.828},
    {time: 11, expected: 1.64075, worst: 0.99327, best: 2.51912, runningExpected: 14.572, runningWorst: 11.66, runningBest: 18.932},
    {time: 12, expected: 1.73966, worst: 1.04884, best: 2.6201, runningExpected: 16.486, runningWorst: 11.954, runningBest: 21.036},
    {time: 13, expected: 1.84611, worst: 1.07219, best: 2.86174, runningExpected: 18.508, runningWorst: 13.25, runningBest: 23.51},
    {time: 14, expected: 1.95431, worst: 1.12683, best: 3.0107, runningExpected: 20.606, runningWorst: 15.402, runningBest: 25.642},
    {time: 15, expected: 2.06094, worst: 1.16787, best: 3.32561, runningExpected: 22.772, runningWorst: 16.154, runningBest: 30.414},
  ]
}

},{}],5:[function(require,module,exports){
module.exports = function (graph, animationSpeed) {
  var oldGraphData;
  var currentRippleTask;

  function doRippleUpdateWithIndex(graphData, index) {
    var animationProgress = index / graphData.timeHorizon;
    var rippleAnimationSpeed = animationSpeed / graphData.timeHorizon * (-animationProgress * animationProgress * animationProgress * 0.5 + 1);

    // sanity check
    if (index >= graphData.projection.length) {
      graph.update(graphData.projection, graphData.timeHorizon, graphData.maxYValue, rippleAnimationSpeed);
      oldGraphData = graphData;
      currentRippleTask=null;
      return
    }

    var newSlice = graphData.projection.slice(0, index);
    var oldSlice = oldGraphData.projection.slice(index, oldGraphData.projection.length);

    var rippleProjection = newSlice.concat(oldSlice);

    oldGraphData.projection = rippleProjection;

    var rippleTimeHorizon = oldGraphData.timeHorizon + (graphData.timeHorizon - oldGraphData.timeHorizon) / graphData.projection.length * index;
    var timeNormalizedRippleProjection = rippleProjection.map(function(dataPoint, i) {
      return {
        time: i / rippleTimeHorizon,
        min: dataPoint.min,
        max: dataPoint.max,
        average: dataPoint.average,
        invested: dataPoint.invested
      }
    });

    var rippleMaxYValue = oldGraphData.maxYValue * (graphData.projection.length - index) / graphData.projection.length + graphData.maxYValue * index / graphData.projection.length;
    graph.update(timeNormalizedRippleProjection, rippleTimeHorizon, rippleMaxYValue, rippleAnimationSpeed);

    currentRippleTask=setTimeout(function() { doRippleUpdateWithIndex(graphData, index+1); }, rippleAnimationSpeed * 0.8);
  }

  return function rippleUpdateGraph(data, timeHorizon, maxYValue) {
    if (currentRippleTask != null) {
      clearTimeout(currentRippleTask);
    }

    var graphData = {
      projection: data,
      timeHorizon: Number(timeHorizon),
      maxYValue: maxYValue
    };

    if (oldGraphData) {
      doRippleUpdateWithIndex(graphData, 1);
    } else {
      graph.update(data, timeHorizon, maxYValue, 0);
      oldGraphData = graphData;
    }
  }
}



},{}]},{},[3])(3)
});
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJsaWIvY29uc3RhbnRzLmpzIiwibGliL2dyYXBoLmpzIiwibGliL2luZGV4LmpzIiwibGliL3Byb2plY3Rpb25EYXRhLmpzIiwibGliL3JpcHBsZVVwZGF0ZS5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hXQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaEdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwibW9kdWxlLmV4cG9ydHMgPSB7XG4gIGNvbG9yczoge1xuICAgIC8vIENPTE9SU1xuICAgIFByaW1hcnlCbHVlOiAnIzM3Mjk4OCcsXG4gICAgRGFya2VyQmx1ZTogJyMzNzI0ODknLFxuICAgIFNlY29uZGFyeUdyZWVuOiAnIzAwQ0M3RScsXG4gICAgTmVnYXRpdmVSZWQ6ICcjRTk0QzRDJyxcblxuICAgIENvbGRCbGFjazogJyMyRjJBNEQnLFxuICAgIFRpdGFuaXVtOiAnIzc0NzE4OCcsXG4gICAgTGlnaHRHcmF5OiAnI0UzRTNFNycsXG4gICAgQWxtb3N0V2hpdGU6ICcjRjVGNUY5JyxcbiAgICBSZWFsbHlXaGl0ZTogJyNGRkYnLFxuICAgIEFsdFdoaXRlOicjRjJGMkY2JyxcbiAgICBTbm93V2hpdGU6ICcjRkNGQ0ZDJyxcbiAgICBMaWdodEJsdWU6ICcjMzkxRjhDJyxcbiAgICBEYXJrQmx1ZTogJyMzMDI4NEYnLFxuXG4gICAgLy8gR1JBRElFTlRTXG4gICAgRGlhZ29uYWxHcmFkaWVudDogJ2xpbmVhci1ncmFkaWVudCgtMTM0ZGVnLCAjMjcyNzU5IDAlLCAjM0QyQTk5IDEwMCUpJyxcbiAgICBHcmFkaWVudE5pZ2h0U2t5QmFja2dyb3VuZDogJ2xpbmVhci1ncmFkaWVudCh0byBib3R0b20sICMyNzI3NTksICMzRDJBOTkpJyxcbiAgICBTaWdudXBHcmFkaWVudDogJ2xpbmVhci1ncmFkaWVudCgxNDhkZWcsICM1OTI3NEYgMCUsICMzRDJBOTkgMTAwJSknXG4gIH1cbn07XG4iLCJ2YXIgZDMgPSByZXF1aXJlKCdkMycpO1xuXG5pZiAodHlwZW9mIGQzLnNlbGVjdCA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgZDMgPSB3aW5kb3cuZDM7XG59XG5cbnZhciBjb2xvcnMgPSByZXF1aXJlKCcuL2NvbnN0YW50cycpLmNvbG9ycztcbnZhciBlbGVtZW50O1xudmFyIHN2ZztcbnZhciBtYXJnaW5zO1xuXG5mdW5jdGlvbiB0aWNrSW5jcmVtZW50V2l0aFNjYWxlTWF4KHNjYWxlTWF4KSB7XG4gIGlmIChzY2FsZU1heCA+IDIwMDAwMDApIHsgcmV0dXJuIDUwMDAwMDsgfVxuICBpZiAoc2NhbGVNYXggPiAxMDAwMDAwKSB7IHJldHVybiAyNTAwMDA7IH1cbiAgaWYgKHNjYWxlTWF4ID4gNDAwMDAwKSB7IHJldHVybiAxMDAwMDA7IH1cbiAgaWYgKHNjYWxlTWF4ID4gMjAwMDAwKSB7IHJldHVybiA1MDAwMDsgfVxuICBpZiAoc2NhbGVNYXggPiAxMDAwMDApIHsgcmV0dXJuIDUwMDAwOyB9XG4gIGlmIChzY2FsZU1heCA+IDUwMDAwKSB7IHJldHVybiAyMDAwMDsgfVxuICBpZiAoc2NhbGVNYXggPiAyNTAwMCkgeyByZXR1cm4gMTAwMDA7IH1cbiAgaWYgKHNjYWxlTWF4ID4gMTAwMDApIHsgcmV0dXJuIDUwMDA7IH1cbiAgaWYgKHNjYWxlTWF4ID4gNTAwMCkgeyByZXR1cm4gMTAwMDsgfVxuICBpZiAoc2NhbGVNYXggPiAyMDAwKSB7IHJldHVybiA1MDA7IH1cbiAgaWYgKHNjYWxlTWF4ID4gMTAwMCkgeyByZXR1cm4gMjUwOyB9XG4gIGlmIChzY2FsZU1heCA+IDUwMCkgeyByZXR1cm4gMTAwOyB9XG4gIHJldHVybiAxMDA7XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZUdyYXBoKG5vZGUsIHRpbWVIb3Jpem9uSW5ZZWFycywgbWF4WVZhbHVlKSB7XG4gIHRpbWVIb3Jpem9uSW5ZZWFycyA9IE51bWJlcih0aW1lSG9yaXpvbkluWWVhcnMpO1xuXG4gIGlmIChpc05hTih0aW1lSG9yaXpvbkluWWVhcnMpKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCd0aW1lSG9yaXpvbkluWWVhcnMgbXVzdCBiZSBhIG51bWJlcicpO1xuICB9XG5cbiAgZWxlbWVudCA9IGQzLnNlbGVjdChub2RlKTtcbiAgdmFyIHdpZHRoID0gZWxlbWVudFswXVswXS5jbGllbnRXaWR0aDtcbiAgdmFyIGhlaWdodCA9IGVsZW1lbnRbMF1bMF0uY2xpZW50SGVpZ2h0O1xuICBtYXJnaW5zID0ge1xuICAgICAgdG9wOiAwLFxuICAgICAgcmlnaHQ6IDEwLFxuICAgICAgYm90dG9tOiA0MCxcbiAgICAgIGxlZnQ6IDEwXG4gICAgfTtcblxuICB2YXIgeFNjYWxlID0gZDMuc2NhbGUubGluZWFyKCkucmFuZ2UoW21hcmdpbnMubGVmdCwgd2lkdGggLSBtYXJnaW5zLmxlZnQgLSBtYXJnaW5zLnJpZ2h0XSkuZG9tYWluKFswLCAxXSk7XG4gIHZhciB5U2NhbGUgPSBkMy5zY2FsZS5saW5lYXIoKS5yYW5nZShbaGVpZ2h0IC0gbWFyZ2lucy50b3AgLSBtYXJnaW5zLmJvdHRvbSwgMF0pLmRvbWFpbihbMCwgbWF4WVZhbHVlXSk7XG5cbiAgc3ZnID0gZWxlbWVudC5hcHBlbmQoJ3N2ZycpXG4gICAgLmF0dHIoJ3dpZHRoJywgd2lkdGgpXG4gICAgLmF0dHIoJ2hlaWdodCcsIGhlaWdodCk7XG5cbiAgdmFyIGRlZnMgPSBzdmcuYXBwZW5kKCdkZWZzJyk7XG5cbiAgZGVmcy5hcHBlbmQoJ2NsaXBQYXRoJylcbiAgICAuYXR0cignaWQnLCAnY2xpcHBpbmdQYXRoJylcbiAgICAuYXBwZW5kKCdyZWN0JylcbiAgICAuYXR0cignaWQnLCAnY2xpcHBpbmdSZWN0JylcbiAgICAuYXR0cigneCcsIHhTY2FsZSgwKSlcbiAgICAuYXR0cignd2lkdGgnLCB4U2NhbGUoMSkgLSB4U2NhbGUoMCkpXG4gICAgLmF0dHIoJ3knLCAwKVxuICAgIC5hdHRyKCdoZWlnaHQnLCBoZWlnaHQpO1xuXG4gIGRlZnMuYXBwZW5kKCdjbGlwUGF0aCcpXG4gICAgLmF0dHIoJ2lkJywgJ3llYXJzQ2xpcHBpbmdQYXRoJylcbiAgICAuYXBwZW5kKCdyZWN0JylcbiAgICAuYXR0cignaWQnLCAnY2xpcHBpbmdSZWN0JylcbiAgICAuYXR0cigneCcsIHhTY2FsZSgwKSAtIG1hcmdpbnMubGVmdClcbiAgICAuYXR0cignd2lkdGgnLCB4U2NhbGUoMSkgLSB4U2NhbGUoMCkgKyBtYXJnaW5zLmxlZnQgKyAxNSlcbiAgICAuYXR0cigneScsIDApXG4gICAgLmF0dHIoJ2hlaWdodCcsIGhlaWdodCk7XG5cblxuICBkZWZzLmFwcGVuZCgncGF0dGVybicpXG4gICAgLmF0dHIoJ2lkJywgJ3N0cmlwZWRHcmF5JylcbiAgICAuYXR0cigncGF0dGVyblVuaXRzJywgJ3VzZXJTcGFjZU9uVXNlJylcbiAgICAuYXR0cignd2lkdGgnLCA0KVxuICAgIC5hdHRyKCdoZWlnaHQnLCA0KVxuICAgIC5hcHBlbmQoJ3BhdGgnKVxuICAgIC5hdHRyKCdkJywgJ00tMSwxIGwyLC0yIE0wLDQgbDQsLTQgTTMsNSBsMiwtMicpXG4gICAgLmF0dHIoJ3N0cm9rZScsIGNvbG9ycy5MaWdodEdyYXkpXG4gICAgLmF0dHIoJ3N0cm9rZS13aWR0aCcsIDEpO1xuXG4gIHN2Zy5hcHBlbmQoJ2cnKVxuICAgIC5hdHRyKCdjbGlwLXBhdGgnLCAndXJsKCN5ZWFyc0NsaXBwaW5nUGF0aCknKVxuICAgIC5hdHRyKCdpZCcsICd5ZWFyc0hvbGRlcicpO1xuXG4gIHN2Zy5hcHBlbmQoJ3BhdGgnKVxuICAgIC5hdHRyKCdjbGFzcycsICdhcmVhJylcbiAgICAuYXR0cignY2xpcC1wYXRoJywgJ3VybCgjY2xpcHBpbmdQYXRoKScpXG4gICAgLmF0dHIoJ2ZpbGwnLCAndXJsKCNzdHJpcGVkR3JheSknKTtcblxuICBzdmcuYXBwZW5kKCdwYXRoJylcbiAgICAuYXR0cignY2xhc3MnLCAnaW52ZXN0ZWRMaW5lJylcbiAgICAuYXR0cignc3Ryb2tlJywgY29sb3JzLlRpdGFuaXVtKVxuICAgIC5hdHRyKCdzdHJva2Utd2lkdGgnLCAyKVxuICAgIC5zdHlsZSgnc3Ryb2tlLWRhc2hhcnJheScsICc0LDQnKVxuICAgIC5hdHRyKCdjbGlwLXBhdGgnLCAndXJsKCNjbGlwcGluZ1BhdGgpJylcbiAgICAuYXR0cignZmlsbCcsICd0cmFuc3BhcmVudCcpO1xuXG4gIHN2Zy5hcHBlbmQoJ3BhdGgnKVxuICAgIC5hdHRyKCdjbGFzcycsICdtYXhMaW5lJylcbiAgICAuYXR0cignc3Ryb2tlJywgY29sb3JzLlNlY29uZGFyeUdyZWVuKVxuICAgIC5hdHRyKCdzdHJva2Utd2lkdGgnLCAzKVxuICAgIC5hdHRyKCdjbGlwLXBhdGgnLCAndXJsKCNjbGlwcGluZ1BhdGgpJylcbiAgICAuYXR0cignZmlsbCcsICdub25lJyk7XG5cbiAgc3ZnLmFwcGVuZCgncGF0aCcpXG4gICAgLmF0dHIoJ2NsYXNzJywgJ2F2ZXJhZ2VMaW5lJylcbiAgICAuYXR0cignc3Ryb2tlJywgY29sb3JzLlByaW1hcnlCbHVlKVxuICAgIC5hdHRyKCdzdHJva2Utd2lkdGgnLCAzKVxuICAgIC5hdHRyKCdjbGlwLXBhdGgnLCAndXJsKCNjbGlwcGluZ1BhdGgpJylcbiAgICAuYXR0cignZmlsbCcsICdub25lJyk7XG5cbiAgc3ZnLmFwcGVuZCgncGF0aCcpXG4gICAgLmF0dHIoJ2NsYXNzJywgJ21pbkxpbmUnKVxuICAgIC5hdHRyKCdzdHJva2UnLCBjb2xvcnMuTmVnYXRpdmVSZWQpXG4gICAgLmF0dHIoJ3N0cm9rZS13aWR0aCcsIDMpXG4gICAgLmF0dHIoJ2NsaXAtcGF0aCcsICd1cmwoI2NsaXBwaW5nUGF0aCknKVxuICAgIC5hdHRyKCdmaWxsJywgJ3RyYW5zcGFyZW50Jyk7XG5cbiAgLypzdmcuYXBwZW5kKCd0ZXh0JylcbiAgICAuYXR0cignaWQnLCAnZ3JhcGhMYWJlbCcpXG4gICAgLmNsYXNzZWQoJ21heExhYmVsIGdyYXBoTGFiZWwnLCB0cnVlKVxuICAgIC5hdHRyKCd5JywgeVNjYWxlKDApKVxuICAgIC5hdHRyKCd4JywgeFNjYWxlKDEpKVxuICAgIC5hdHRyKFwidGV4dC1hbmNob3JcIiwgXCJzdGFydFwiKTtcblxuICBzdmcuYXBwZW5kKCd0ZXh0JylcbiAgICAuY2xhc3NlZCgnYXZlcmFnZUxhYmVsIGdyYXBoTGFiZWwnLCB0cnVlKVxuICAgIC5hdHRyKCd5JywgeVNjYWxlKDApKVxuICAgIC5hdHRyKCd4JywgeFNjYWxlKDEpKVxuICAgIC5hdHRyKFwidGV4dC1hbmNob3JcIiwgXCJzdGFydFwiKTtcblxuICBzdmcuYXBwZW5kKCd0ZXh0JylcbiAgICAuY2xhc3NlZCgnbWluTGFiZWwgZ3JhcGhMYWJlbCcsIHRydWUpXG4gICAgLmF0dHIoJ3knLCB5U2NhbGUoMCkpXG4gICAgLmF0dHIoJ3gnLCB4U2NhbGUoMSkpXG4gICAgLmF0dHIoXCJ0ZXh0LWFuY2hvclwiLCBcInN0YXJ0XCIpO1xuKi9cbiAgLy8geCBheGlzXG4gIHN2Zy5hcHBlbmQoJ3JlY3QnKVxuICAgIC5hdHRyKCdjbGFzcycsICdheGlzJylcbiAgICAuYXR0cigneScsIHlTY2FsZSgwKSAtIDEpXG4gICAgLmF0dHIoJ2hlaWdodCcsIDMpXG4gICAgLmF0dHIoJ3gnLCAtMSlcbiAgICAuYXR0cignd2lkdGgnLCB4U2NhbGUoMSkgKyAyKVxuICAgIC5hdHRyKCdmaWxsJywgY29sb3JzLlRpdGFuaXVtKVxuICAgIC5zdHlsZSgnc3Ryb2tlJywgY29sb3JzLlJlYWxseVdoaXRlKVxuICAgIC5zdHlsZSgnc3Ryb2tlLXdpZHRoJywgJzFweCcpO1xufVxuXG52YXIgeVNjYWxlT2xkID0gbnVsbDtcblxuZnVuY3Rpb24gdXBkYXRlR3JhcGgoZGF0YSwgdGltZUhvcml6b25JblllYXJzLCBtYXhZVmFsdWUsIGFuaW1hdGlvblNwZWVkKSB7XG4gIHRpbWVIb3Jpem9uSW5ZZWFycyA9IE51bWJlcih0aW1lSG9yaXpvbkluWWVhcnMpO1xuXG4gIGlmIChpc05hTih0aW1lSG9yaXpvbkluWWVhcnMpKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCd0aW1lSG9yaXpvbkluWWVhcnMgbXVzdCBiZSBhIG51bWJlcicpO1xuICB9XG5cbiAgdmFyIHdpZHRoID0gZWxlbWVudFswXVswXS5jbGllbnRXaWR0aDtcbiAgdmFyIGhlaWdodCA9IGVsZW1lbnRbMF1bMF0uY2xpZW50SGVpZ2h0O1xuXG4gIHN2Zy5hdHRyKCd3aWR0aCcsIHdpZHRoKVxuICAgIC5hdHRyKCdoZWlnaHQnLCBoZWlnaHQpO1xuXG4gIHZhciB4U2NhbGUgPSBkMy5zY2FsZS5saW5lYXIoKS5yYW5nZShbbWFyZ2lucy5sZWZ0LCB3aWR0aCAtIG1hcmdpbnMubGVmdCAtIG1hcmdpbnMucmlnaHRdKS5kb21haW4oWzAsIDFdKTtcblxuICB2YXIgeVNjYWxlID0gZDMuc2NhbGUubGluZWFyKCkucmFuZ2UoW2hlaWdodCAtIG1hcmdpbnMudG9wIC0gbWFyZ2lucy5ib3R0b20sIDBdKS5kb21haW4oWzAsIG1heFlWYWx1ZV0pO1xuICAvLyB2YXIgeVNjYWxlU2NhbGFyID0gZDMuc2NhbGUubGluZWFyKCkucmFuZ2UoWzAsIGhlaWdodCAtIG1hcmdpbnMudG9wIC0gbWFyZ2lucy5ib3R0b21dKS5kb21haW4oWzAsIG1heFlWYWx1ZV0pO1xuICAvLyBpbml0aWFsIGNvbmRpdGlvblxuICBpZiAoeVNjYWxlT2xkID09IG51bGwpIHtcbiAgICB5U2NhbGVPbGQgPSB5U2NhbGU7XG4gIH1cblxuICB2YXIgbWluUGF0aCA9IGQzLnN2Zy5saW5lKClcbiAgICAueChmdW5jdGlvbiAoZCkgeyByZXR1cm4geFNjYWxlKGQudGltZSk7IH0pXG4gICAgLnkoZnVuY3Rpb24gKGQpIHsgcmV0dXJuIHlTY2FsZShkLm1pbik7IH0pXG4gICAgLmludGVycG9sYXRlKCdiYXNpcycpO1xuXG4gIHZhciBhdmVyYWdlUGF0aCA9IGQzLnN2Zy5saW5lKClcbiAgICAueChmdW5jdGlvbiAoZCkgeyByZXR1cm4geFNjYWxlKGQudGltZSk7IH0pXG4gICAgLnkoZnVuY3Rpb24gKGQpIHsgcmV0dXJuIHlTY2FsZShkLmF2ZXJhZ2UpOyB9KVxuICAgIC5pbnRlcnBvbGF0ZSgnYmFzaXMnKTtcblxuICB2YXIgbWF4UGF0aCA9IGQzLnN2Zy5saW5lKClcbiAgICAueChmdW5jdGlvbiAoZCkgeyByZXR1cm4geFNjYWxlKGQudGltZSk7IH0pXG4gICAgLnkoZnVuY3Rpb24gKGQpIHsgcmV0dXJuIHlTY2FsZShkLm1heCk7IH0pXG4gICAgLmludGVycG9sYXRlKCdiYXNpcycpO1xuXG4gIHZhciBpbnZlc3RlZFBhdGggPSBkMy5zdmcubGluZSgpXG4gICAgLngoZnVuY3Rpb24gKGQpIHsgcmV0dXJuIHhTY2FsZShkLnRpbWUpOyB9KVxuICAgIC55KGZ1bmN0aW9uIChkKSB7IHJldHVybiB5U2NhbGUoZC5pbnZlc3RlZCk7IH0pXG4gICAgLmludGVycG9sYXRlKCdiYXNpcycpO1xuXG4gIHZhciBhcmVhID0gZDMuc3ZnLmFyZWEoKVxuICAgIC54KGZ1bmN0aW9uIChkKSB7IHJldHVybiB4U2NhbGUoZC50aW1lKTsgfSlcbiAgICAueTAoZnVuY3Rpb24gKGQpIHsgcmV0dXJuIHlTY2FsZShkLm1pbik7IH0pXG4gICAgLnkxKGZ1bmN0aW9uIChkKSB7IHJldHVybiB5U2NhbGUoZC5tYXgpOyB9KVxuICAgIC5pbnRlcnBvbGF0ZSgnbGluZWFyJyk7XG5cbiAgc3ZnLnRyYW5zaXRpb24oKVxuICAgIC5zZWxlY3QoJy5tYXhMaW5lJylcbiAgICAuZHVyYXRpb24oYW5pbWF0aW9uU3BlZWQpXG4gICAgLmF0dHIoJ2QnLCBtYXhQYXRoKGRhdGEpKTtcblxuICBzdmcudHJhbnNpdGlvbigpXG4gICAgLnNlbGVjdCgnLmF2ZXJhZ2VMaW5lJylcbiAgICAuZHVyYXRpb24oYW5pbWF0aW9uU3BlZWQpXG4gICAgLmF0dHIoJ2QnLCBhdmVyYWdlUGF0aChkYXRhKSk7XG5cbiAgc3ZnLnRyYW5zaXRpb24oKVxuICAgIC5zZWxlY3QoJy5taW5MaW5lJylcbiAgICAuZHVyYXRpb24oYW5pbWF0aW9uU3BlZWQpXG4gICAgLmF0dHIoJ2QnLCBtaW5QYXRoKGRhdGEpKTtcblxuICBzdmcudHJhbnNpdGlvbigpXG4gICAgLnNlbGVjdCgnLmludmVzdGVkTGluZScpXG4gICAgLmR1cmF0aW9uKGFuaW1hdGlvblNwZWVkKVxuICAgIC5hdHRyKCdkJywgaW52ZXN0ZWRQYXRoKGRhdGEpKTtcblxuICBzdmcudHJhbnNpdGlvbigpXG4gICAgLnNlbGVjdCgnLmFyZWEnKVxuICAgIC5kdXJhdGlvbihhbmltYXRpb25TcGVlZClcbiAgICAuYXR0cignZCcsIGFyZWEoZGF0YSkpO1xuXG4gIHN2Zy50cmFuc2l0aW9uKClcbiAgICAuc2VsZWN0KCcjY2xpcHBpbmdSZWN0JylcbiAgICAuYXR0cigneCcsIHhTY2FsZSgwKSlcbiAgICAuYXR0cignd2lkdGgnLCB4U2NhbGUoMSkgLSB4U2NhbGUoMCkpXG4gICAgLmF0dHIoJ3knLCAwKVxuICAgIC5hdHRyKCdoZWlnaHQnLCBoZWlnaHQpO1xuXG4gIC8vIGRyYXcgZW5kIHZhbHVlc1xuICAvKnZhciBlbmREYXRhUG9pbnQgPSBkYXRhW01hdGguZmxvb3IodGltZUhvcml6b25JblllYXJzKV07XG5cbiAgc3ZnLnRyYW5zaXRpb24oKVxuICAgIC5zZWxlY3QoJy5tYXhMYWJlbCcpXG4gICAgLmR1cmF0aW9uKGFuaW1hdGlvblNwZWVkKVxuICAgIC5hdHRyKCd5JywgeVNjYWxlKGVuZERhdGFQb2ludC5tYXgpKVxuICAgIC5hdHRyKCd4JywgeFNjYWxlKDEpKVxuICAgIC50ZXh0KGdldEZvcm1hdHRlZE51bWJlcihlbmREYXRhUG9pbnQubWF4KSk7XG5cbiAgc3ZnLnRyYW5zaXRpb24oKVxuICAgIC5zZWxlY3QoJy5hdmVyYWdlTGFiZWwnKVxuICAgIC5kdXJhdGlvbihhbmltYXRpb25TcGVlZClcbiAgICAuYXR0cigneScsIHlTY2FsZShlbmREYXRhUG9pbnQuYXZlcmFnZSkpXG4gICAgLmF0dHIoJ3gnLCB4U2NhbGUoMSkpXG4gICAgLnRleHQoZ2V0Rm9ybWF0dGVkTnVtYmVyKGVuZERhdGFQb2ludC5hdmVyYWdlKSk7XG5cbiAgc3ZnLnRyYW5zaXRpb24oKVxuICAgIC5zZWxlY3QoJy5taW5MYWJlbCcpXG4gICAgLmR1cmF0aW9uKGFuaW1hdGlvblNwZWVkKVxuICAgIC5hdHRyKCd5JywgeVNjYWxlKGVuZERhdGFQb2ludC5taW4pKVxuICAgIC5hdHRyKCd4JywgeFNjYWxlKDEpKVxuICAgIC50ZXh0KGdldEZvcm1hdHRlZE51bWJlcihlbmREYXRhUG9pbnQubWluKSk7XG4qL1xuICAvLyBkcmF3IHRpY2tzXG4gIHZhciB0aWNrSW5jcmVtZW50ID0gdGlja0luY3JlbWVudFdpdGhTY2FsZU1heChtYXhZVmFsdWUsIGRhdGFbMF0uYW1vdW50KTtcblxuICB2YXIgdGlja0xhYmVscyA9IFtdO1xuXG4gIHZhciBpID0gMDtcbiAgd2hpbGUgKGkgPCBtYXhZVmFsdWUpIHtcbiAgICBpZiAoaSAhPSAwKSB7XG4gICAgICB0aWNrTGFiZWxzLnB1c2goeyB5OiBpLCBsYWJlbDogaS50b0xvY2FsZVN0cmluZygnZGEnLCB7IHN0eWxlOiAnY3VycmVuY3knLCBjdXJyZW5jeTogJ0RLSycgfSkgLCB2YWx1ZTogaX0pO1xuICAgIH1cbiAgICBpICs9IHRpY2tJbmNyZW1lbnQ7XG4gIH1cblxuICB2YXIgdGlja3MgPSBzdmcuc2VsZWN0QWxsKCcudGljaycpLmRhdGEodGlja0xhYmVscywgZnVuY3Rpb24oZCwgaSkgeyByZXR1cm4gZC52YWx1ZTsgfSk7XG5cbiAgdGlja3MuZW50ZXIoKVxuICAgIC5hcHBlbmQoJ3RleHQnKVxuICAgIC5hdHRyKCdjbGFzcycsICd0aWNrJylcbiAgICAuYXR0cigneCcsIHhTY2FsZSgxKSArIDUpXG4gICAgLmF0dHIoJ2ZpbGwnLCBjb2xvcnMuVGl0YW5pdW0pXG4gICAgLmF0dHIoJ3RleHQtYW5jaG9yJywgJ2VuZCcpXG4gICAgLnRleHQoZnVuY3Rpb24gKGQpIHsgcmV0dXJuIGQubGFiZWw7IH0pXG4gICAgLmF0dHIoJ3knLCBmdW5jdGlvbiAoZCkgeyByZXR1cm4geVNjYWxlT2xkKGQueSkgKyA0OyB9KVxuICAgIC50cmFuc2l0aW9uKClcbiAgICAuZHVyYXRpb24oYW5pbWF0aW9uU3BlZWQpXG4gICAgLmF0dHIoJ3knLCBmdW5jdGlvbiAoZCkgeyByZXR1cm4geVNjYWxlKGQueSkgKyA0OyB9KTtcblxuICB0aWNrcy5leGl0KClcbiAgICAudHJhbnNpdGlvbigpXG4gICAgLmR1cmF0aW9uKGFuaW1hdGlvblNwZWVkKVxuICAgIC5hdHRyKCd5JywgZnVuY3Rpb24gKGQpIHsgcmV0dXJuIHlTY2FsZShkLnkpICsgNDsgfSlcbiAgICAuYXR0cignb3BhY2l0eScsIDApXG4gICAgLnJlbW92ZSgpO1xuXG4gIHRpY2tzLnRyYW5zaXRpb24oKVxuICAgIC5kdXJhdGlvbihhbmltYXRpb25TcGVlZClcbiAgICAuYXR0cigneCcsIHhTY2FsZSgxKSArIDUpXG4gICAgLmF0dHIoJ3knLCBmdW5jdGlvbiAoZCkgeyByZXR1cm4geVNjYWxlKGQueSkgKyA0OyB9KVxuICAgIC50ZXh0KGZ1bmN0aW9uIChkKSB7IHJldHVybiBkLmxhYmVsOyB9KTtcblxuICBzdmcuc2VsZWN0QWxsKCcjZW5kTGFiZWwnKVxuICAgIC5hdHRyKCd4JywgeFNjYWxlKDEpIC0gNSlcbiAgICAuYXR0cigneScsIHlTY2FsZSgwKSArIDE3KVxuICAgIC50ZXh0KG5ldyBEYXRlKCkuZ2V0RnVsbFllYXIoKSArIHRpbWVIb3Jpem9uSW5ZZWFycyk7XG5cbiAgc3ZnLnNlbGVjdEFsbCgnLmF4aXMnKVxuICAgIC5hdHRyKCd5JywgeVNjYWxlKDApIC0gMSlcbiAgICAuYXR0cignd2lkdGgnLCB4U2NhbGUoMSkgKyAyKTtcblxuICAvLyBkcmF3IHllYXJzXG4gIHZhciBhcnJheU9mWWVhcnMgPSBkMy5yYW5nZSh0aW1lSG9yaXpvbkluWWVhcnMgKyAxKTtcbiAgdmFyIHllYXJMaW5lcyA9IHN2Zy5zZWxlY3QoJyN5ZWFyc0hvbGRlcicpLnNlbGVjdEFsbCgnLnllYXJMaW5lSG9sZGVyJykuZGF0YShhcnJheU9mWWVhcnMpO1xuICB2YXIgbmV3WWVhckxpbmVIb2xkZXJzID0geWVhckxpbmVzLmVudGVyKClcbiAgICAuYXBwZW5kKCdnJylcbiAgICAuYXR0cignY2xhc3MnLCAneWVhckxpbmVIb2xkZXInKVxuICAgIC5hdHRyKCd0cmFuc2Zvcm0nLCBmdW5jdGlvbiAoZCkgeyByZXR1cm4gJ3RyYW5zbGF0ZSgnICsgeWVhckxpbmVUcmFuc2xhdGlvbldpdGhJbmRleEFuZE1heEluZGV4KHRpbWVIb3Jpem9uSW5ZZWFycywgdGltZUhvcml6b25JblllYXJzKSArICcsIDApJzsgfSk7XG5cbiAgbmV3WWVhckxpbmVIb2xkZXJzLmFwcGVuZCgnbGluZScpXG4gICAgLmF0dHIoJ3kxJywgZnVuY3Rpb24gKGQpIHsgcmV0dXJuIHlTY2FsZSgwKTsgfSlcbiAgICAuYXR0cigneTInLCBmdW5jdGlvbiAoZCkgeyByZXR1cm4geVNjYWxlKG1heFlWYWx1ZSk7IH0pXG4gICAgLnN0eWxlKCdzdHJva2UnLCBjb2xvcnMuTGlnaHRHcmF5KVxuICAgIC5zdHlsZSgnc3Ryb2tlLXdpZHRoJywgMSlcbiAgICAuYXR0cigneDEnLCAxKVxuICAgIC5hdHRyKCd4MicsIDEpO1xuICBuZXdZZWFyTGluZUhvbGRlcnMuaW5zZXJ0KCd0ZXh0JylcbiAgICAudGV4dChmdW5jdGlvbiAoZCkgeyByZXR1cm4gZCA9PSAwID8gJ0kgREFHJyA6IG5ldyBEYXRlKCkuZ2V0RnVsbFllYXIoKSArIGQ7IH0pXG4gICAgLmF0dHIoJ3gnLCAwKVxuICAgIC5hdHRyKCd5JywgZnVuY3Rpb24gKGQpIHsgcmV0dXJuIHlTY2FsZSgwKSArIDE3OyB9KVxuICAgIC5hdHRyKCdmaWxsJywgY29sb3JzLlRpdGFuaXVtKVxuICAgIC5hdHRyKCd0ZXh0LWFuY2hvcicsICdtaWRkbGUnKTtcblxuICBmdW5jdGlvbiB5ZWFyTGluZVRyYW5zbGF0aW9uV2l0aEluZGV4QW5kTWF4SW5kZXgoaW5kZXgsIG1heEluZGV4KSB7XG4gICAgdmFyIHJldCA9IDA7XG4gICAgICByZXQgPSB4U2NhbGUoaW5kZXggLyB0aW1lSG9yaXpvbkluWWVhcnMpO1xuXG4gICAgcmV0dXJuIHJldDtcbiAgfVxuXG4gIHllYXJMaW5lcy5leGl0KClcbiAgICAudHJhbnNpdGlvbigpXG4gICAgLmR1cmF0aW9uKGFuaW1hdGlvblNwZWVkKVxuICAgIC5hdHRyKCd0cmFuc2Zvcm0nLCBmdW5jdGlvbiAoZCkgeyByZXR1cm4gJ3RyYW5zbGF0ZSgnICsgeWVhckxpbmVUcmFuc2xhdGlvbldpdGhJbmRleEFuZE1heEluZGV4KGQsIHRpbWVIb3Jpem9uSW5ZZWFycykgKyAnLCAwKSc7IH0pXG4gICAgLnJlbW92ZSgpO1xuXG4gIHllYXJMaW5lcy50cmFuc2l0aW9uKClcbiAgICAuZHVyYXRpb24oYW5pbWF0aW9uU3BlZWQpXG4gICAgLmF0dHIoJ3RyYW5zZm9ybScsIGZ1bmN0aW9uIChkKSB7IHJldHVybiAndHJhbnNsYXRlKCcgKyB5ZWFyTGluZVRyYW5zbGF0aW9uV2l0aEluZGV4QW5kTWF4SW5kZXgoZCwgdGltZUhvcml6b25JblllYXJzKSArICcsIDApJzsgfSk7XG5cbiAgeVNjYWxlT2xkID0geVNjYWxlO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgaW5pdDogY3JlYXRlR3JhcGgsXG4gIHVwZGF0ZTogdXBkYXRlR3JhcGhcbn07XG4iLCJ2YXIgcHJvamVjdGlvbkRhdGEgPSByZXF1aXJlKCcuL3Byb2plY3Rpb25EYXRhJyk7XG52YXIgZ3JhcGggPSByZXF1aXJlKCcuL2dyYXBoJyk7XG52YXIgcmlwcGxlVXBkYXRlID0gcmVxdWlyZSgnLi9yaXBwbGVVcGRhdGUnKTtcblxuZnVuY3Rpb24gY2FsY3VsYXRlUHJvamVjdGlvbkRhdGEocHJvamVjdGlvblBlcmNlbnRhZ2VEYXRhLCBpbml0aWFsRGVwb3NpdCwgbW9udGhseURlcG9zaXQsIHRpbWVIb3Jpem9uKSB7XG4gIHZhciBwcm9qZWN0aW9uID0gcHJvamVjdGlvblBlcmNlbnRhZ2VEYXRhLm1hcChmdW5jdGlvbihkYXRhUG9pbnQpIHtcbiAgICB2YXIgeWVhcmx5RGVwb3NpdCA9IDEyICogbW9udGhseURlcG9zaXQ7XG5cbiAgICByZXR1cm4ge1xuICAgICAgdGltZTogZGF0YVBvaW50LnRpbWUgLyBOdW1iZXIodGltZUhvcml6b24pLFxuICAgICAgbWluOiB5ZWFybHlEZXBvc2l0ICogZGF0YVBvaW50LnJ1bm5pbmdXb3JzdCArIGRhdGFQb2ludC53b3JzdCAqIGluaXRpYWxEZXBvc2l0LFxuICAgICAgYXZlcmFnZTogeWVhcmx5RGVwb3NpdCAqIGRhdGFQb2ludC5ydW5uaW5nRXhwZWN0ZWQgKyBkYXRhUG9pbnQuZXhwZWN0ZWQgKiBpbml0aWFsRGVwb3NpdCxcbiAgICAgIG1heDogeWVhcmx5RGVwb3NpdCAqIGRhdGFQb2ludC5ydW5uaW5nQmVzdCArIGRhdGFQb2ludC5iZXN0ICogaW5pdGlhbERlcG9zaXQsXG4gICAgICBpbnZlc3RlZDogeWVhcmx5RGVwb3NpdCAqIGRhdGFQb2ludC50aW1lICsgaW5pdGlhbERlcG9zaXRcbiAgICB9XG4gIH0pO1xuXG4gIHJldHVybiBwcm9qZWN0aW9uO1xufVxuXG5mdW5jdGlvbiBnZXRNYXhZQXhpc1ZhbHVlKGRhdGEpIHtcbiAgdmFyIGhpZ2hlc3RQb3NzaWJsZVJldHVyblByb2plY3Rpb24gPSBjYWxjdWxhdGVQcm9qZWN0aW9uRGF0YShwcm9qZWN0aW9uRGF0YVsnb3Bwb3J0dW5pdHknXSwgZGF0YS5pbml0aWFsRGVwb3NpdCwgZGF0YS5tb250aGx5RGVwb3NpdCwgZGF0YS50aW1lSG9yaXpvbik7XG4gIHZhciBoaWdoZXN0UG9zc2libGVSZXR1cm4gPSBoaWdoZXN0UG9zc2libGVSZXR1cm5Qcm9qZWN0aW9uW2hpZ2hlc3RQb3NzaWJsZVJldHVyblByb2plY3Rpb24ubGVuZ3RoIC0gMV0ubWF4O1xuXG4gIHJldHVybiBoaWdoZXN0UG9zc2libGVSZXR1cm4gKyBNYXRoLnBvdyhoaWdoZXN0UG9zc2libGVSZXR1cm4sIDAuNSkgKiAxMDA7XG59XG5cbmZ1bmN0aW9uIFByb2plY3Rpb25HcmFwaChvcHRpb25zKSB7XG4gIGlmICh0eXBlb2Ygb3B0aW9ucyAhPT0gJ29iamVjdCcpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ1Byb2plY3Rpb25HcmFwaDogQW4gb2JqZWN0IG11c3QgYmUgc3VwcGxpZWQgYXMgZmlyc3QgYXJndW1lbnQnKTtcbiAgfVxuXG4gIGlmICghb3B0aW9ucy5lbGVtZW50IHx8IG9wdGlvbnMuZWxlbWVudC5ub2RlVHlwZSAhPT0gMSkge1xuICAgIHRocm93IG5ldyBFcnJvcignUHJvamVjdGlvbkdyYXBoOiBvcHRpb25zLmVsZW1lbnQgbXVzdCBiZSBhIERPTSBFbGVtZW50Jyk7XG4gIH1cblxuICBpZiAodHlwZW9mIG9wdGlvbnMuZGF0YSAhPT0gJ29iamVjdCcpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ1Byb2plY3Rpb25HcmFwaDogb3B0aW9ucy5kYXRhIG11c3QgYmUgYSBkYXRhIG9iamVjdCcpXG4gIH1cblxuICB2YXIgaW5pdGlhbFN0YXRlID0ge1xuICAgIGluaXRpYWxEZXBvc2l0OiBvcHRpb25zLmRhdGEuaW5pdGlhbERlcG9zaXQgfHwgMTAwMDAsXG4gICAgbW9udGhseURlcG9zaXQ6IG9wdGlvbnMuZGF0YS5tb250aGx5RGVwb3NpdCB8fCAwLFxuICAgIHRpbWVIb3Jpem9uOiBvcHRpb25zLmRhdGEudGltZUhvcml6b24gfHwgJzE1JyxcbiAgICByaXNrUHJvZmlsZTogb3B0aW9ucy5kYXRhLnJpc2tQcm9maWxlIHx8ICdiYWxhbmNlZCdcbiAgfTtcblxuICB0aGlzLmVsZW1lbnQgPSBvcHRpb25zLmVsZW1lbnQ7XG4gIHRoaXMuYW5pbWF0aW9uU3BlZWQgPSBvcHRpb25zLmFuaW1hdGlvblNwZWVkIHx8IDUwMDsgLy8gTWlsbGlzZWNvbmRzXG5cbiAgaWYgKG9wdGlvbnMucmlwcGxlVXBkYXRlRWZmZWN0KSB7XG4gICAgdGhpcy5yaXBwbGVVcGRhdGUgPSByaXBwbGVVcGRhdGUoZ3JhcGgsIHRoaXMuYW5pbWF0aW9uU3BlZWQpO1xuICB9XG5cbiAgZ3JhcGguaW5pdCh0aGlzLmVsZW1lbnQsIGluaXRpYWxTdGF0ZS50aW1lSG9yaXpvbiwgZ2V0TWF4WUF4aXNWYWx1ZShpbml0aWFsU3RhdGUpKTtcblxuICB0aGlzLnNldFN0YXRlKGluaXRpYWxTdGF0ZSk7XG59XG5cblByb2plY3Rpb25HcmFwaC5wcm90b3R5cGUgPSB7XG4gIHNldFN0YXRlOiBmdW5jdGlvbiAobmV4dFN0YXRlKSB7XG4gICAgdmFyIHN0YXRlID0gT2JqZWN0LmFzc2lnbih7fSwgdGhpcy5zdGF0ZSwgbmV4dFN0YXRlKTtcblxuICAgIHZhciBncmFwaERhdGEgPSBjYWxjdWxhdGVQcm9qZWN0aW9uRGF0YShwcm9qZWN0aW9uRGF0YVtzdGF0ZS5yaXNrUHJvZmlsZV0sIHN0YXRlLmluaXRpYWxEZXBvc2l0LCBzdGF0ZS5tb250aGx5RGVwb3NpdCwgc3RhdGUudGltZUhvcml6b24pO1xuXG4gICAgaWYgKHRoaXMucmlwcGxlVXBkYXRlKSB7XG4gICAgICB0aGlzLnJpcHBsZVVwZGF0ZShncmFwaERhdGEsIHN0YXRlLnRpbWVIb3Jpem9uLCBnZXRNYXhZQXhpc1ZhbHVlKHN0YXRlKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGlmICghdGhpcy5zdGF0ZSkge1xuICAgICAgICBncmFwaC51cGRhdGUoZ3JhcGhEYXRhLCBzdGF0ZS50aW1lSG9yaXpvbiwgZ2V0TWF4WUF4aXNWYWx1ZShzdGF0ZSksIDApO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZ3JhcGgudXBkYXRlKGdyYXBoRGF0YSwgc3RhdGUudGltZUhvcml6b24sIGdldE1heFlBeGlzVmFsdWUoc3RhdGUpLCB0aGlzLmFuaW1hdGlvblNwZWVkKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICB0aGlzLnN0YXRlID0gc3RhdGU7XG4gIH0sXG5cbiAgZGVzdHJ1Y3Q6IGZ1bmN0aW9uICAoKSB7XG4gICAgZGVsZXRlIHRoaXMuZWxlbWVudDtcbiAgfVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IFByb2plY3Rpb25HcmFwaDtcbiIsIm1vZHVsZS5leHBvcnRzID0ge1xuICBiYWxhbmNlZDogW1xuICAgIHt0aW1lOiAwLCBleHBlY3RlZDogMSwgd29yc3Q6IDEsIGJlc3Q6IDEsIHJ1bm5pbmdFeHBlY3RlZDogMCwgcnVubmluZ1dvcnN0OiAwLCBydW5uaW5nQmVzdDogMH0sXG4gICAge3RpbWU6IDEsIGV4cGVjdGVkOiAxLjAxODcsIHdvcnN0OiAwLjg2MTIxLCBiZXN0OiAxLjE1NjQ1LCBydW5uaW5nRXhwZWN0ZWQ6IDEsIHJ1bm5pbmdXb3JzdDogMSwgcnVubmluZ0Jlc3Q6IDF9LFxuICAgIHt0aW1lOiAyLCBleHBlY3RlZDogMS4wNDc1NCwgd29yc3Q6IDAuODQ1OCwgYmVzdDogMS4yNDcyNywgcnVubmluZ0V4cGVjdGVkOiAyLjAzLCBydW5uaW5nV29yc3Q6IDEuOTk4LCBydW5uaW5nQmVzdDogMi4wMDR9LFxuICAgIHt0aW1lOiAzLCBleHBlY3RlZDogMS4wNzc4LCB3b3JzdDogMC44NDM4NiwgYmVzdDogMS4zMTc4NiwgcnVubmluZ0V4cGVjdGVkOiAzLjA5MiwgcnVubmluZ1dvcnN0OiAyLjg4MiwgcnVubmluZ0Jlc3Q6IDMuMTY4fSxcbiAgICB7dGltZTogNCwgZXhwZWN0ZWQ6IDEuMTA3NTYsIHdvcnN0OiAwLjg0OTA4LCBiZXN0OiAxLjM4NDI4LCBydW5uaW5nRXhwZWN0ZWQ6IDQuMTc4LCBydW5uaW5nV29yc3Q6IDQuMDMyLCBydW5uaW5nQmVzdDogNC41MDJ9LFxuICAgIHt0aW1lOiA1LCBleHBlY3RlZDogMS4xNDgzOSwgd29yc3Q6IDAuODY0MDcsIGJlc3Q6IDEuNDQ5MzcsIHJ1bm5pbmdFeHBlY3RlZDogNS4zMzYsIHJ1bm5pbmdXb3JzdDogNC44NzgsIHJ1bm5pbmdCZXN0OiA2LjI2Nn0sXG4gICAge3RpbWU6IDYsIGV4cGVjdGVkOiAxLjE5NzQxLCB3b3JzdDogMC44OTQ1OCwgYmVzdDogMS41NDIyOSwgcnVubmluZ0V4cGVjdGVkOiA2LjU3LCBydW5uaW5nV29yc3Q6IDYuMjgsIHJ1bm5pbmdCZXN0OiA3LjkzNn0sXG4gICAge3RpbWU6IDcsIGV4cGVjdGVkOiAxLjI1Nzk2LCB3b3JzdDogMC45MTgwMiwgYmVzdDogMS42MzkyNSwgcnVubmluZ0V4cGVjdGVkOiA3LjkxLCBydW5uaW5nV29yc3Q6IDYuNTIyLCBydW5uaW5nQmVzdDogOC40MzZ9LFxuICAgIHt0aW1lOiA4LCBleHBlY3RlZDogMS4zMjIsIHdvcnN0OiAwLjkzNzI2LCBiZXN0OiAxLjc3NzQ4LCBydW5uaW5nRXhwZWN0ZWQ6IDkuMzIsIHJ1bm5pbmdXb3JzdDogOC4wNzIsIHJ1bm5pbmdCZXN0OiAxMC43NzZ9LFxuICAgIHt0aW1lOiA5LCBleHBlY3RlZDogMS4zOTQzMSwgd29yc3Q6IDAuOTkwOTMsIGJlc3Q6IDEuODY2MTEsIHJ1bm5pbmdFeHBlY3RlZDogMTAuODQ2LCBydW5uaW5nV29yc3Q6IDkuNTYsIHJ1bm5pbmdCZXN0OiAxMi41Nzh9LFxuICAgIHt0aW1lOiAxMCwgZXhwZWN0ZWQ6IDEuNDY3NjMsIHdvcnN0OiAwLjk5Mzc3LCBiZXN0OiAyLjA0MTExLCBydW5uaW5nRXhwZWN0ZWQ6IDEyLjQyMiwgcnVubmluZ1dvcnN0OiA5LjY5NCwgcnVubmluZ0Jlc3Q6IDE0LjgyNn0sXG4gICAge3RpbWU6IDExLCBleHBlY3RlZDogMS41NTgxMywgd29yc3Q6IDEuMDY0NTYsIGJlc3Q6IDIuMjE5ODEsIHJ1bm5pbmdFeHBlY3RlZDogMTQuMTk2LCBydW5uaW5nV29yc3Q6IDExLjI4OCwgcnVubmluZ0Jlc3Q6IDE4LjE2fSxcbiAgICB7dGltZTogMTIsIGV4cGVjdGVkOiAxLjY0NTg0LCB3b3JzdDogMS4xMTE5NSwgYmVzdDogMi4yOTUzNCwgcnVubmluZ0V4cGVjdGVkOiAxNi4wMTgsIHJ1bm5pbmdXb3JzdDogMTEuMjY2LCBydW5uaW5nQmVzdDogMTkuNzIyfSxcbiAgICB7dGltZTogMTMsIGV4cGVjdGVkOiAxLjczOTY0LCB3b3JzdDogMS4xMjQ3MSwgYmVzdDogMi41MDc4OCwgcnVubmluZ0V4cGVjdGVkOiAxNy45NCwgcnVubmluZ1dvcnN0OiAxMy41MjIsIHJ1bm5pbmdCZXN0OiAyMC4yMX0sXG4gICAge3RpbWU6IDE0LCBleHBlY3RlZDogMS44MzQ4MSwgd29yc3Q6IDEuMTgwODIsIGJlc3Q6IDIuNjQxNDgsIHJ1bm5pbmdFeHBlY3RlZDogMTkuOTI4LCBydW5uaW5nV29yc3Q6IDE1LjU2LCBydW5uaW5nQmVzdDogMjIuNDY0fSxcbiAgICB7dGltZTogMTUsIGV4cGVjdGVkOiAxLjkyNzkyLCB3b3JzdDogMS4yMTg4MywgYmVzdDogMi44NDM4NywgcnVubmluZ0V4cGVjdGVkOiAyMS45NjIsIHJ1bm5pbmdXb3JzdDogMTcuMjM2LCBydW5uaW5nQmVzdDogMjcuMjg2fSxcbiAgXVxuLFxuICBtb2RlcmF0ZTogW1xuICAgIHt0aW1lOiAwLCBleHBlY3RlZDogMSwgd29yc3Q6IDEsIGJlc3Q6IDEsIHJ1bm5pbmdFeHBlY3RlZDogMCwgcnVubmluZ1dvcnN0OiAwLCBydW5uaW5nQmVzdDogMH0sXG4gICAge3RpbWU6IDEsIGV4cGVjdGVkOiAxLjAxMTU1ODQ0MTU1ODQ0LCB3b3JzdDogMC44ODYxNzM4MjYxNzM4MjYsIGJlc3Q6IDEuMTE2MTMzODY2MTMzODcsIHJ1bm5pbmdFeHBlY3RlZDogMSwgcnVubmluZ1dvcnN0OiAxLCBydW5uaW5nQmVzdDogMX0sXG4gICAge3RpbWU6IDIsIGV4cGVjdGVkOiAxLjAzMjkzNzA2MjkzNzA2LCB3b3JzdDogMC44ODM1NzY0MjM1NzY0MjQsIGJlc3Q6IDEuMTYzODQ2MTUzODQ2MTUsIHJ1bm5pbmdFeHBlY3RlZDogMi4wMjIsIHJ1bm5pbmdXb3JzdDogMS45MiwgcnVubmluZ0Jlc3Q6IDIuMDgyfSxcbiAgICB7dGltZTogMywgZXhwZWN0ZWQ6IDEuMDU2MzgzNjE2MzgzNjIsIHdvcnN0OiAwLjg4NDkzNTA2NDkzNTA2NSwgYmVzdDogMS4yMTM1NDY0NTM1NDY0NSwgcnVubmluZ0V4cGVjdGVkOiAzLjA3LCBydW5uaW5nV29yc3Q6IDIuOTc4LCBydW5uaW5nQmVzdDogMy4xOTZ9LFxuICAgIHt0aW1lOiA0LCBleHBlY3RlZDogMS4wODA2MjkzNzA2MjkzNywgd29yc3Q6IDAuOTAzMDY2OTMzMDY2OTMzLCBiZXN0OiAxLjI1Mzc2NjIzMzc2NjIzLCBydW5uaW5nRXhwZWN0ZWQ6IDQuMTQyLCBydW5uaW5nV29yc3Q6IDMuODY2LCBydW5uaW5nQmVzdDogNC4yNjZ9LFxuICAgIHt0aW1lOiA1LCBleHBlY3RlZDogMS4xMTU3MjQyNzU3MjQyOCwgd29yc3Q6IDAuOTIyMDE3OTgyMDE3OTgyLCBiZXN0OiAxLjMwNjU0MzQ1NjU0MzQ2LCBydW5uaW5nRXhwZWN0ZWQ6IDUuMjgsIHJ1bm5pbmdXb3JzdDogNC44MDYsIHJ1bm5pbmdCZXN0OiA1LjY3Nn0sXG4gICAge3RpbWU6IDYsIGV4cGVjdGVkOiAxLjE1NDk5NTAwNDk5NTAxLCB3b3JzdDogMC45NTE2NTgzNDE2NTgzNDIsIGJlc3Q6IDEuMzgyNTc3NDIyNTc3NDIsIHJ1bm5pbmdFeHBlY3RlZDogNi40NzIsIHJ1bm5pbmdXb3JzdDogNi4wNDQsIHJ1bm5pbmdCZXN0OiA3LjAzNn0sXG4gICAge3RpbWU6IDcsIGV4cGVjdGVkOiAxLjIwNzM0MjY1NzM0MjY2LCB3b3JzdDogMC45ODE0Mzg1NjE0Mzg1NjEsIGJlc3Q6IDEuNDU5ODUwMTQ5ODUwMTUsIHJ1bm5pbmdFeHBlY3RlZDogNy43NjgsIHJ1bm5pbmdXb3JzdDogNy4wMzYsIHJ1bm5pbmdCZXN0OiA4LjM2OH0sXG4gICAge3RpbWU6IDgsIGV4cGVjdGVkOiAxLjI2MjYxNzM4MjYxNzM4LCB3b3JzdDogMS4wMTQwNjU5MzQwNjU5MywgYmVzdDogMS41NjU1NzQ0MjU1NzQ0MywgcnVubmluZ0V4cGVjdGVkOiA5LjEyOCwgcnVubmluZ1dvcnN0OiA4LjIxNiwgcnVubmluZ0Jlc3Q6IDEwLjI0OH0sXG4gICAge3RpbWU6IDksIGV4cGVjdGVkOiAxLjMyNTU1NDQ0NTU1NDQ1LCB3b3JzdDogMS4wNTUxNzQ4MjUxNzQ4MywgYmVzdDogMS42NTI0Njc1MzI0Njc1MywgcnVubmluZ0V4cGVjdGVkOiAxMC41OTIsIHJ1bm5pbmdXb3JzdDogOS40MDYsIHJ1bm5pbmdCZXN0OiAxMi4wNTh9LFxuICAgIHt0aW1lOiAxMCwgZXhwZWN0ZWQ6IDEuMzg5NzAwMjk5NzAwMywgd29yc3Q6IDEuMDc2NjEzMzg2NjEzMzksIGJlc3Q6IDEuNzYzODM2MTYzODM2MTYsIHJ1bm5pbmdFeHBlY3RlZDogMTIuMTA4LCBydW5uaW5nV29yc3Q6IDEwLjczOCwgcnVubmluZ0Jlc3Q6IDE0LjA2fSxcbiAgICB7dGltZTogMTEsIGV4cGVjdGVkOiAxLjQ2NTgwNDE5NTgwNDIsIHdvcnN0OiAxLjEzOTgwMDE5OTgwMDIsIGJlc3Q6IDEuODY2NDAzNTk2NDAzNiwgcnVubmluZ0V4cGVjdGVkOiAxMy43NzYsIHJ1bm5pbmdXb3JzdDogMTEuNTE4LCBydW5uaW5nQmVzdDogMTUuNzV9LFxuICAgIHt0aW1lOiAxMiwgZXhwZWN0ZWQ6IDEuNTQxMTE4ODgxMTE4ODgsIHdvcnN0OiAxLjE3MzQ1NjU0MzQ1NjU0LCBiZXN0OiAxLjk4NDY2NTMzNDY2NTMzLCBydW5uaW5nRXhwZWN0ZWQ6IDE1LjQ5NCwgcnVubmluZ1dvcnN0OiAxMi45NDIsIHJ1bm5pbmdCZXN0OiAxNy4zMjZ9LFxuICAgIHt0aW1lOiAxMywgZXhwZWN0ZWQ6IDEuNjIxNjc4MzIxNjc4MzIsIHdvcnN0OiAxLjIwMTY5ODMwMTY5ODMsIGJlc3Q6IDIuMTA2MDczOTI2MDczOTMsIHJ1bm5pbmdFeHBlY3RlZDogMTcuMzA4LCBydW5uaW5nV29yc3Q6IDE0LjIzMiwgcnVubmluZ0Jlc3Q6IDE5LjkyNH0sXG4gICAge3RpbWU6IDE0LCBleHBlY3RlZDogMS43MDMxOTY4MDMxOTY4LCB3b3JzdDogMS4yNDUyMzQ3NjUyMzQ3NywgYmVzdDogMi4yMzUyMTQ3ODUyMTQ3OSwgcnVubmluZ0V4cGVjdGVkOiAxOS4xOCwgcnVubmluZ1dvcnN0OiAxNi40NjQsIHJ1bm5pbmdCZXN0OiAyMS43Mn0sXG4gICAge3RpbWU6IDE1LCBleHBlY3RlZDogMS43ODIwMDc5OTIwMDc5OSwgd29yc3Q6IDEuMjkzNDA2NTkzNDA2NTksIGJlc3Q6IDIuMzcxMjQ4NzUxMjQ4NzUsIHJ1bm5pbmdFeHBlY3RlZDogMjEuMDc4LCBydW5uaW5nV29yc3Q6IDE3LjE2MiwgcnVubmluZ0Jlc3Q6IDI2LjI0Nn0sXG4gIF1cbixcbiAgbW9kZXJhdGVzaG9ydDogW1xuICAgIHt0aW1lOiAwLCBleHBlY3RlZDogMSwgd29yc3Q6IDEsIGJlc3Q6IDEsIHJ1bm5pbmdFeHBlY3RlZDogMCwgcnVubmluZ1dvcnN0OiAwLCBydW5uaW5nQmVzdDogMH0sXG4gICAge3RpbWU6IDEsIGV4cGVjdGVkOiAxLjAxMzgxLCB3b3JzdDogMC44ODE4OCwgYmVzdDogMS4xMzE2MywgcnVubmluZ0V4cGVjdGVkOiAxLCBydW5uaW5nV29yc3Q6IDEsIHJ1bm5pbmdCZXN0OiAxfSxcbiAgICB7dGltZTogMiwgZXhwZWN0ZWQ6IDEuMDM3NTQsIHdvcnN0OiAwLjg2NjkzLCBiZXN0OiAxLjE5MywgcnVubmluZ0V4cGVjdGVkOiAyLjAyNCwgcnVubmluZ1dvcnN0OiAxLjk0NCwgcnVubmluZ0Jlc3Q6IDIuMDV9LFxuICAgIHt0aW1lOiAzLCBleHBlY3RlZDogMS4wNjMwOCwgd29yc3Q6IDAuODY5NDcsIGJlc3Q6IDEuMjUxNzEsIHJ1bm5pbmdFeHBlY3RlZDogMy4wNzYsIHJ1bm5pbmdXb3JzdDogMi44MjQsIHJ1bm5pbmdCZXN0OiAzLjQ3Mn0sXG4gICAge3RpbWU6IDQsIGV4cGVjdGVkOiAxLjA4ODg0LCB3b3JzdDogMC44ODAzMiwgYmVzdDogMS4zMTI4NiwgcnVubmluZ0V4cGVjdGVkOiA0LjE1MiwgcnVubmluZ1dvcnN0OiA0LjE0NCwgcnVubmluZ0Jlc3Q6IDQuMTd9LFxuICAgIHt0aW1lOiA1LCBleHBlY3RlZDogMS4xMjU0Nywgd29yc3Q6IDAuODk0OTYsIGJlc3Q6IDEuMzU3MDQsIHJ1bm5pbmdFeHBlY3RlZDogNS4yOTgsIHJ1bm5pbmdXb3JzdDogNC44MTgsIHJ1bm5pbmdCZXN0OiA1Ljg3fSxcbiAgICB7dGltZTogNiwgZXhwZWN0ZWQ6IDEuMTY3ODIsIHdvcnN0OiAwLjkyNjM1LCBiZXN0OiAxLjQzMzUxLCBydW5uaW5nRXhwZWN0ZWQ6IDYuNTAyLCBydW5uaW5nV29yc3Q6IDUuOTE4LCBydW5uaW5nQmVzdDogNy4zMDR9LFxuICAgIHt0aW1lOiA3LCBleHBlY3RlZDogMS4yMjI1Miwgd29yc3Q6IDAuOTUzNzcsIGJlc3Q6IDEuNTIzNDIsIHJ1bm5pbmdFeHBlY3RlZDogNy44MSwgcnVubmluZ1dvcnN0OiA3LjI5LCBydW5uaW5nQmVzdDogOC40NDJ9LFxuICAgIHt0aW1lOiA4LCBleHBlY3RlZDogMS4yODAzMiwgd29yc3Q6IDAuOTc4MzEsIGJlc3Q6IDEuNjMzNzcsIHJ1bm5pbmdFeHBlY3RlZDogOS4xODQsIHJ1bm5pbmdXb3JzdDogOC4xNSwgcnVubmluZ0Jlc3Q6IDEwLjQ1NH0sXG4gICAge3RpbWU6IDksIGV4cGVjdGVkOiAxLjM0NTk0LCB3b3JzdDogMS4wMjcwNCwgYmVzdDogMS43MjM0LCBydW5uaW5nRXhwZWN0ZWQ6IDEwLjY2NiwgcnVubmluZ1dvcnN0OiA5LjMzNiwgcnVubmluZ0Jlc3Q6IDExLjYwNn0sXG4gICAge3RpbWU6IDEwLCBleHBlY3RlZDogMS40MTI1NCwgd29yc3Q6IDEuMDM5NTQsIGJlc3Q6IDEuODQ3MTcsIHJ1bm5pbmdFeHBlY3RlZDogMTIuMTk4LCBydW5uaW5nV29yc3Q6IDEwLjgxMiwgcnVubmluZ0Jlc3Q6IDE0LjQyNn0sXG4gICAge3RpbWU6IDExLCBleHBlY3RlZDogMS40OTI5NSwgd29yc3Q6IDEuMTA2MzcsIGJlc3Q6IDEuOTgwMjUsIHJ1bm5pbmdFeHBlY3RlZDogMTMuOSwgcnVubmluZ1dvcnN0OiAxMS45OSwgcnVubmluZ0Jlc3Q6IDE2Ljg4NH0sXG4gICAge3RpbWU6IDEyLCBleHBlY3RlZDogMS41NzE3OSwgd29yc3Q6IDEuMTQxMywgYmVzdDogMi4xMDI3NSwgcnVubmluZ0V4cGVjdGVkOiAxNS42NDgsIHJ1bm5pbmdXb3JzdDogMTMuNTMsIHJ1bm5pbmdCZXN0OiAxOC43NDR9LFxuICAgIHt0aW1lOiAxMywgZXhwZWN0ZWQ6IDEuNjU1OTcsIHdvcnN0OiAxLjE2OTksIGJlc3Q6IDIuMjMyOSwgcnVubmluZ0V4cGVjdGVkOiAxNy40OTIsIHJ1bm5pbmdXb3JzdDogMTMuMjI0LCBydW5uaW5nQmVzdDogMTkuODI2fSxcbiAgICB7dGltZTogMTQsIGV4cGVjdGVkOiAxLjc0MTE5LCB3b3JzdDogMS4yMDA4NywgYmVzdDogMi4zNTI1MSwgcnVubmluZ0V4cGVjdGVkOiAxOS4zOTYsIHJ1bm5pbmdXb3JzdDogMTUuMTcsIHJ1bm5pbmdCZXN0OiAyMy41Mzh9LFxuICAgIHt0aW1lOiAxNSwgZXhwZWN0ZWQ6IDEuODIzOSwgd29yc3Q6IDEuMjUzMjksIGJlc3Q6IDIuNTQ4NjYsIHJ1bm5pbmdFeHBlY3RlZDogMjEuMzMsIHJ1bm5pbmdXb3JzdDogMTcuNSwgcnVubmluZ0Jlc3Q6IDI2LjIyOH0sXG4gIF1cbixcbiAgb3Bwb3J0dW5pdHk6IFtcbiAgICB7dGltZTogMCwgZXhwZWN0ZWQ6IDEsIHdvcnN0OiAxLCBiZXN0OiAxLCBydW5uaW5nRXhwZWN0ZWQ6IDAsIHJ1bm5pbmdXb3JzdDogMCwgcnVubmluZ0Jlc3Q6IDB9LFxuICAgIHt0aW1lOiAxLCBleHBlY3RlZDogMS4wNDMzMywgd29yc3Q6IDAuNzEzNiwgYmVzdDogMS4zMjIxNiwgcnVubmluZ0V4cGVjdGVkOiAxLCBydW5uaW5nV29yc3Q6IDEsIHJ1bm5pbmdCZXN0OiAxfSxcbiAgICB7dGltZTogMiwgZXhwZWN0ZWQ6IDEuMDk4MTQsIHdvcnN0OiAwLjY3ODQ2LCBiZXN0OiAxLjU0MjAyLCBydW5uaW5nRXhwZWN0ZWQ6IDIuMDU0LCBydW5uaW5nV29yc3Q6IDEuNjksIHJ1bm5pbmdCZXN0OiAyLjIyMn0sXG4gICAge3RpbWU6IDMsIGV4cGVjdGVkOiAxLjE1MTI3LCB3b3JzdDogMC42ODI5OSwgYmVzdDogMS42OTQ1LCBydW5uaW5nRXhwZWN0ZWQ6IDMuMTYyLCBydW5uaW5nV29yc3Q6IDIuNjk2LCBydW5uaW5nQmVzdDogMy41ODh9LFxuICAgIHt0aW1lOiA0LCBleHBlY3RlZDogMS4yMDA4OCwgd29yc3Q6IDAuNjcxNzYsIGJlc3Q6IDEuODM3MiwgcnVubmluZ0V4cGVjdGVkOiA0LjMwMiwgcnVubmluZ1dvcnN0OiA0LjA0NiwgcnVubmluZ0Jlc3Q6IDUuNDI2fSxcbiAgICB7dGltZTogNSwgZXhwZWN0ZWQ6IDEuMjYzMTYsIHdvcnN0OiAwLjY2MjQ1LCBiZXN0OiAxLjk3NDI5LCBydW5uaW5nRXhwZWN0ZWQ6IDUuNTM2LCBydW5uaW5nV29yc3Q6IDQuMzc0LCBydW5uaW5nQmVzdDogNy4zMX0sXG4gICAge3RpbWU6IDYsIGV4cGVjdGVkOiAxLjM0NjU5LCB3b3JzdDogMC42NzU4NSwgYmVzdDogMi4yMDMxNywgcnVubmluZ0V4cGVjdGVkOiA2LjkyLCBydW5uaW5nV29yc3Q6IDQuOTM2LCBydW5uaW5nQmVzdDogNy4zMX0sXG4gICAge3RpbWU6IDcsIGV4cGVjdGVkOiAxLjQzNzI5LCB3b3JzdDogMC43MDE0MywgYmVzdDogMi40NDkwNiwgcnVubmluZ0V4cGVjdGVkOiA4LjQxLCBydW5uaW5nV29yc3Q6IDYuNTUyLCBydW5uaW5nQmVzdDogOS40NzZ9LFxuICAgIHt0aW1lOiA4LCBleHBlY3RlZDogMS41MzIxMywgd29yc3Q6IDAuNzE0NDYsIGJlc3Q6IDIuNjg1ODgsIHJ1bm5pbmdFeHBlY3RlZDogMTAuMDA4LCBydW5uaW5nV29yc3Q6IDYuMDIsIHJ1bm5pbmdCZXN0OiAxMy4yMDh9LFxuICAgIHt0aW1lOiA5LCBleHBlY3RlZDogMS42MzY2MSwgd29yc3Q6IDAuNzQ1MTUsIGJlc3Q6IDIuODYyNzgsIHJ1bm5pbmdFeHBlY3RlZDogMTEuNzYyLCBydW5uaW5nV29yc3Q6IDcuNzg4LCBydW5uaW5nQmVzdDogMTQuOTh9LFxuICAgIHt0aW1lOiAxMCwgZXhwZWN0ZWQ6IDEuNzQ1MTUsIHdvcnN0OiAwLjczNzcyLCBiZXN0OiAzLjI3MzUxLCBydW5uaW5nRXhwZWN0ZWQ6IDEzLjU1MiwgcnVubmluZ1dvcnN0OiA3Ljc4MiwgcnVubmluZ0Jlc3Q6IDE1Ljc3fSxcbiAgICB7dGltZTogMTEsIGV4cGVjdGVkOiAxLjg5MTc5LCB3b3JzdDogMC43ODkyNiwgYmVzdDogMy41NzQ0NCwgcnVubmluZ0V4cGVjdGVkOiAxNS43MTgsIHJ1bm5pbmdXb3JzdDogOS43NDQsIHJ1bm5pbmdCZXN0OiAyMy44MDh9LFxuICAgIHt0aW1lOiAxMiwgZXhwZWN0ZWQ6IDIuMDIzMjUsIHdvcnN0OiAwLjgxMzk0LCBiZXN0OiAzLjg5NDIsIHJ1bm5pbmdFeHBlY3RlZDogMTcuOTIyLCBydW5uaW5nV29yc3Q6IDEwLjY1NiwgcnVubmluZ0Jlc3Q6IDMzLjM4NH0sXG4gICAge3RpbWU6IDEzLCBleHBlY3RlZDogMi4xNzA0Niwgd29yc3Q6IDAuODI3NTQsIGJlc3Q6IDQuMzIxNTMsIHJ1bm5pbmdFeHBlY3RlZDogMjAuMjY0LCBydW5uaW5nV29yc3Q6IDExLjk3NiwgcnVubmluZ0Jlc3Q6IDMxLjYwOH0sXG4gICAge3RpbWU6IDE0LCBleHBlY3RlZDogMi4zMjEwNywgd29yc3Q6IDAuODc1OTQsIGJlc3Q6IDQuNzExMzYsIHJ1bm5pbmdFeHBlY3RlZDogMjIuNzAyLCBydW5uaW5nV29yc3Q6IDE0LjI4MiwgcnVubmluZ0Jlc3Q6IDMyLjU2OH0sXG4gICAge3RpbWU6IDE1LCBleHBlY3RlZDogMi40NzAyOCwgd29yc3Q6IDAuODkyMTEsIGJlc3Q6IDQuOTk5MzgsIHJ1bm5pbmdFeHBlY3RlZDogMjUuMjgsIHJ1bm5pbmdXb3JzdDogMTcuNzY2LCBydW5uaW5nQmVzdDogMzcuNDQ4fSxcbiAgXVxuLFxuICBwcm9ncmVzc2l2ZTogW1xuICAgIHt0aW1lOiAwLCBleHBlY3RlZDogMSwgd29yc3Q6IDEsIGJlc3Q6IDEsIHJ1bm5pbmdFeHBlY3RlZDogMCwgcnVubmluZ1dvcnN0OiAwLCBydW5uaW5nQmVzdDogMH0sXG4gICAge3RpbWU6IDEsIGV4cGVjdGVkOiAxLjAyNDg1LCB3b3JzdDogMC44MjExOSwgYmVzdDogMS4xOTA1LCBydW5uaW5nRXhwZWN0ZWQ6IDEsIHJ1bm5pbmdXb3JzdDogMSwgcnVubmluZ0Jlc3Q6IDF9LFxuICAgIHt0aW1lOiAyLCBleHBlY3RlZDogMS4wNjAxNCwgd29yc3Q6IDAuODEyNjksIGJlc3Q6IDEuMzE4NDMsIHJ1bm5pbmdFeHBlY3RlZDogMi4wMzQsIHJ1bm5pbmdXb3JzdDogMS44NzYsIHJ1bm5pbmdCZXN0OiAyLjIwMn0sXG4gICAge3RpbWU6IDMsIGV4cGVjdGVkOiAxLjA5NjI1LCB3b3JzdDogMC44MDU4MiwgYmVzdDogMS40MDMsIHJ1bm5pbmdFeHBlY3RlZDogMy4xMSwgcnVubmluZ1dvcnN0OiAyLjg3MiwgcnVubmluZ0Jlc3Q6IDMuNTIyfSxcbiAgICB7dGltZTogNCwgZXhwZWN0ZWQ6IDEuMTMxMDEsIHdvcnN0OiAwLjgwMzE1LCBiZXN0OiAxLjQ4MzAxLCBydW5uaW5nRXhwZWN0ZWQ6IDQuMjEsIHJ1bm5pbmdXb3JzdDogMy4zNjgsIHJ1bm5pbmdCZXN0OiA0Ljc0Nn0sXG4gICAge3RpbWU6IDUsIGV4cGVjdGVkOiAxLjE3NzE1LCB3b3JzdDogMC44MTU5NiwgYmVzdDogMS41Njc4NywgcnVubmluZ0V4cGVjdGVkOiA1LjM4NiwgcnVubmluZ1dvcnN0OiA0LjQ5LCBydW5uaW5nQmVzdDogNi4wNjR9LFxuICAgIHt0aW1lOiA2LCBleHBlY3RlZDogMS4yMzQ2NCwgd29yc3Q6IDAuODQ4NzQsIGJlc3Q6IDEuNzAwMDYsIHJ1bm5pbmdFeHBlY3RlZDogNi42NTgsIHJ1bm5pbmdXb3JzdDogNC45MjYsIHJ1bm5pbmdCZXN0OiA3LjkyOH0sXG4gICAge3RpbWU6IDcsIGV4cGVjdGVkOiAxLjMwMjYzLCB3b3JzdDogMC44NTM3MSwgYmVzdDogMS44MjI0MywgcnVubmluZ0V4cGVjdGVkOiA4LjAzNCwgcnVubmluZ1dvcnN0OiA2LjY4NCwgcnVubmluZ0Jlc3Q6IDkuNjY0fSxcbiAgICB7dGltZTogOCwgZXhwZWN0ZWQ6IDEuMzc0NDksIHdvcnN0OiAwLjg5MzA4LCBiZXN0OiAxLjk4NTI0LCBydW5uaW5nRXhwZWN0ZWQ6IDkuNDksIHJ1bm5pbmdXb3JzdDogOC4wMjgsIHJ1bm5pbmdCZXN0OiAxMy4yMDJ9LFxuICAgIHt0aW1lOiA5LCBleHBlY3RlZDogMS40NTUxMywgd29yc3Q6IDAuOTM3NzUsIGJlc3Q6IDIuMDg1MjcsIHJ1bm5pbmdFeHBlY3RlZDogMTEuMDcyLCBydW5uaW5nV29yc3Q6IDkuNzg4LCBydW5uaW5nQmVzdDogMTMuNTA4fSxcbiAgICB7dGltZTogMTAsIGV4cGVjdGVkOiAxLjUzNzA2LCB3b3JzdDogMC45MjUyMiwgYmVzdDogMi4zMTMzNiwgcnVubmluZ0V4cGVjdGVkOiAxMi43MDIsIHJ1bm5pbmdXb3JzdDogMTAuMDE4LCBydW5uaW5nQmVzdDogMTYuODI4fSxcbiAgICB7dGltZTogMTEsIGV4cGVjdGVkOiAxLjY0MDc1LCB3b3JzdDogMC45OTMyNywgYmVzdDogMi41MTkxMiwgcnVubmluZ0V4cGVjdGVkOiAxNC41NzIsIHJ1bm5pbmdXb3JzdDogMTEuNjYsIHJ1bm5pbmdCZXN0OiAxOC45MzJ9LFxuICAgIHt0aW1lOiAxMiwgZXhwZWN0ZWQ6IDEuNzM5NjYsIHdvcnN0OiAxLjA0ODg0LCBiZXN0OiAyLjYyMDEsIHJ1bm5pbmdFeHBlY3RlZDogMTYuNDg2LCBydW5uaW5nV29yc3Q6IDExLjk1NCwgcnVubmluZ0Jlc3Q6IDIxLjAzNn0sXG4gICAge3RpbWU6IDEzLCBleHBlY3RlZDogMS44NDYxMSwgd29yc3Q6IDEuMDcyMTksIGJlc3Q6IDIuODYxNzQsIHJ1bm5pbmdFeHBlY3RlZDogMTguNTA4LCBydW5uaW5nV29yc3Q6IDEzLjI1LCBydW5uaW5nQmVzdDogMjMuNTF9LFxuICAgIHt0aW1lOiAxNCwgZXhwZWN0ZWQ6IDEuOTU0MzEsIHdvcnN0OiAxLjEyNjgzLCBiZXN0OiAzLjAxMDcsIHJ1bm5pbmdFeHBlY3RlZDogMjAuNjA2LCBydW5uaW5nV29yc3Q6IDE1LjQwMiwgcnVubmluZ0Jlc3Q6IDI1LjY0Mn0sXG4gICAge3RpbWU6IDE1LCBleHBlY3RlZDogMi4wNjA5NCwgd29yc3Q6IDEuMTY3ODcsIGJlc3Q6IDMuMzI1NjEsIHJ1bm5pbmdFeHBlY3RlZDogMjIuNzcyLCBydW5uaW5nV29yc3Q6IDE2LjE1NCwgcnVubmluZ0Jlc3Q6IDMwLjQxNH0sXG4gIF1cbn1cbiIsIm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKGdyYXBoLCBhbmltYXRpb25TcGVlZCkge1xuICB2YXIgb2xkR3JhcGhEYXRhO1xuICB2YXIgY3VycmVudFJpcHBsZVRhc2s7XG5cbiAgZnVuY3Rpb24gZG9SaXBwbGVVcGRhdGVXaXRoSW5kZXgoZ3JhcGhEYXRhLCBpbmRleCkge1xuICAgIHZhciBhbmltYXRpb25Qcm9ncmVzcyA9IGluZGV4IC8gZ3JhcGhEYXRhLnRpbWVIb3Jpem9uO1xuICAgIHZhciByaXBwbGVBbmltYXRpb25TcGVlZCA9IGFuaW1hdGlvblNwZWVkIC8gZ3JhcGhEYXRhLnRpbWVIb3Jpem9uICogKC1hbmltYXRpb25Qcm9ncmVzcyAqIGFuaW1hdGlvblByb2dyZXNzICogYW5pbWF0aW9uUHJvZ3Jlc3MgKiAwLjUgKyAxKTtcblxuICAgIC8vIHNhbml0eSBjaGVja1xuICAgIGlmIChpbmRleCA+PSBncmFwaERhdGEucHJvamVjdGlvbi5sZW5ndGgpIHtcbiAgICAgIGdyYXBoLnVwZGF0ZShncmFwaERhdGEucHJvamVjdGlvbiwgZ3JhcGhEYXRhLnRpbWVIb3Jpem9uLCBncmFwaERhdGEubWF4WVZhbHVlLCByaXBwbGVBbmltYXRpb25TcGVlZCk7XG4gICAgICBvbGRHcmFwaERhdGEgPSBncmFwaERhdGE7XG4gICAgICBjdXJyZW50UmlwcGxlVGFzaz1udWxsO1xuICAgICAgcmV0dXJuXG4gICAgfVxuXG4gICAgdmFyIG5ld1NsaWNlID0gZ3JhcGhEYXRhLnByb2plY3Rpb24uc2xpY2UoMCwgaW5kZXgpO1xuICAgIHZhciBvbGRTbGljZSA9IG9sZEdyYXBoRGF0YS5wcm9qZWN0aW9uLnNsaWNlKGluZGV4LCBvbGRHcmFwaERhdGEucHJvamVjdGlvbi5sZW5ndGgpO1xuXG4gICAgdmFyIHJpcHBsZVByb2plY3Rpb24gPSBuZXdTbGljZS5jb25jYXQob2xkU2xpY2UpO1xuXG4gICAgb2xkR3JhcGhEYXRhLnByb2plY3Rpb24gPSByaXBwbGVQcm9qZWN0aW9uO1xuXG4gICAgdmFyIHJpcHBsZVRpbWVIb3Jpem9uID0gb2xkR3JhcGhEYXRhLnRpbWVIb3Jpem9uICsgKGdyYXBoRGF0YS50aW1lSG9yaXpvbiAtIG9sZEdyYXBoRGF0YS50aW1lSG9yaXpvbikgLyBncmFwaERhdGEucHJvamVjdGlvbi5sZW5ndGggKiBpbmRleDtcbiAgICB2YXIgdGltZU5vcm1hbGl6ZWRSaXBwbGVQcm9qZWN0aW9uID0gcmlwcGxlUHJvamVjdGlvbi5tYXAoZnVuY3Rpb24oZGF0YVBvaW50LCBpKSB7XG4gICAgICByZXR1cm4ge1xuICAgICAgICB0aW1lOiBpIC8gcmlwcGxlVGltZUhvcml6b24sXG4gICAgICAgIG1pbjogZGF0YVBvaW50Lm1pbixcbiAgICAgICAgbWF4OiBkYXRhUG9pbnQubWF4LFxuICAgICAgICBhdmVyYWdlOiBkYXRhUG9pbnQuYXZlcmFnZSxcbiAgICAgICAgaW52ZXN0ZWQ6IGRhdGFQb2ludC5pbnZlc3RlZFxuICAgICAgfVxuICAgIH0pO1xuXG4gICAgdmFyIHJpcHBsZU1heFlWYWx1ZSA9IG9sZEdyYXBoRGF0YS5tYXhZVmFsdWUgKiAoZ3JhcGhEYXRhLnByb2plY3Rpb24ubGVuZ3RoIC0gaW5kZXgpIC8gZ3JhcGhEYXRhLnByb2plY3Rpb24ubGVuZ3RoICsgZ3JhcGhEYXRhLm1heFlWYWx1ZSAqIGluZGV4IC8gZ3JhcGhEYXRhLnByb2plY3Rpb24ubGVuZ3RoO1xuICAgIGdyYXBoLnVwZGF0ZSh0aW1lTm9ybWFsaXplZFJpcHBsZVByb2plY3Rpb24sIHJpcHBsZVRpbWVIb3Jpem9uLCByaXBwbGVNYXhZVmFsdWUsIHJpcHBsZUFuaW1hdGlvblNwZWVkKTtcblxuICAgIGN1cnJlbnRSaXBwbGVUYXNrPXNldFRpbWVvdXQoZnVuY3Rpb24oKSB7IGRvUmlwcGxlVXBkYXRlV2l0aEluZGV4KGdyYXBoRGF0YSwgaW5kZXgrMSk7IH0sIHJpcHBsZUFuaW1hdGlvblNwZWVkICogMC44KTtcbiAgfVxuXG4gIHJldHVybiBmdW5jdGlvbiByaXBwbGVVcGRhdGVHcmFwaChkYXRhLCB0aW1lSG9yaXpvbiwgbWF4WVZhbHVlKSB7XG4gICAgaWYgKGN1cnJlbnRSaXBwbGVUYXNrICE9IG51bGwpIHtcbiAgICAgIGNsZWFyVGltZW91dChjdXJyZW50UmlwcGxlVGFzayk7XG4gICAgfVxuXG4gICAgdmFyIGdyYXBoRGF0YSA9IHtcbiAgICAgIHByb2plY3Rpb246IGRhdGEsXG4gICAgICB0aW1lSG9yaXpvbjogTnVtYmVyKHRpbWVIb3Jpem9uKSxcbiAgICAgIG1heFlWYWx1ZTogbWF4WVZhbHVlXG4gICAgfTtcblxuICAgIGlmIChvbGRHcmFwaERhdGEpIHtcbiAgICAgIGRvUmlwcGxlVXBkYXRlV2l0aEluZGV4KGdyYXBoRGF0YSwgMSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGdyYXBoLnVwZGF0ZShkYXRhLCB0aW1lSG9yaXpvbiwgbWF4WVZhbHVlLCAwKTtcbiAgICAgIG9sZEdyYXBoRGF0YSA9IGdyYXBoRGF0YTtcbiAgICB9XG4gIH1cbn1cblxuXG4iXX0=
