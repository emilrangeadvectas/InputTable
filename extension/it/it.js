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
			//div.
            var canvasWidth = $element[0].clientWidth-130;
            var canvasHeight = $element[0].clientHeight;
            iframe.width = canvasWidth
            iframe.height = canvasHeight
			iframe.border=0
			iframe.style.border=0
			iframe.style.padding=0
			iframe.style.margin=0
			iframe.style.float="left"

			
            var reload = document.createElement("INPUT")	
            reload.type = "button"
            reload.value = "reload"


            reload.onclick = function()
			{
                qlik.currApp(this).doReload()
			}

			var submit = document.createElement("INPUT")	
            submit.type = "button"
            submit.value = "submit"


			submit.onclick = function()
			{
				iframe.contentWindow.submit_form();				
			}
			
            $element.append(iframe)
            $element.append(reload)
            $element.append(submit)



            
		}
    };
});
