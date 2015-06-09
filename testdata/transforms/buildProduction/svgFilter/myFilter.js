(function () {
    var svgFilter = window.svgFilter;
    var allElements = document.getElementsByTagName('path');
    for (var i = 0; i < allElements.length; i += 1) {
        var element = allElements[i];
        if (svgFilter.color) {
            element.setAttribute('stroke', svgFilter.color);
        }
    }
}());
