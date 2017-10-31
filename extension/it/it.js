define( ["qlik","text!./style.css","text!./config.json"], function (qlik,cssContent,configJSON) {
    'use strict';

    $( '<style>' ).html(cssContent).appendTo( 'head' );

	var config = JSON.parse(configJSON)
	
	var definitionObject = {
        type: "items",
        component: "accordion",
        items: {
          dimensions: {
            uses: "dimensions",
              min:0,
			  max:0
			
            },
            measures: {
              uses: "measures",
              min:0,
			  max:0
            },
            sorting: {
              uses: "sorting",
              min:0,
			  max:0
            },
            appearance: {
              uses: "settings",
	}}}

    return {
        "definition": definitionObject,
        paint: function ( $element, layout ) {
			$element.empty();
            var iframe = document.createElement("IFRAME")			
            iframe.src = config.url

            var canvasWidth = $element[0].clientWidth;
            var canvasHeight = $element[0].clientHeight;
            iframe.width = canvasWidth
            iframe.height = canvasHeight
			iframe.border=0
			iframe.style.border=0
			iframe.style.padding=0
			iframe.style.margin=0
			
            $element.append(iframe)            
		}
    };
});
