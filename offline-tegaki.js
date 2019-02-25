'use strict';
let tegaki = null;

createTegaki(
	document.querySelector('meta[name="tegaki-resource-uri"]').getAttribute('content'), // resourceLocation
	'en', // language
	'basic-round', // shape pack
	'shiipainter', // tone pack
	'default', // bindings
	function(newTegaki)	// callback
	{
		tegaki = newTegaki;
		// set save callback
		tegaki.save = function()
		{
			alert('this is an offline copy that doesn\'t upload anywhere');
		};
		document.body.removeChild(document.querySelector('#placeholder'));
		document.body.appendChild(tegaki.container);
		// resize
		tegaki.resize(document.getElementById('tegaki-width').value, document.getElementById('tegaki-height').value);
		// default brush size
		tegaki.changeTool(0);
		tegaki.changeShape(1);
		// default eraser size
		tegaki.changeTool(1);
		tegaki.changeShape(10);
		// start with brush
		tegaki.changeTool(0);
	}
);
// add listener for canvas size change
document.getElementById('tegaki-dimensions').addEventListener('submit', function(e)
{
	e.preventDefault();
	if (confirm(e.currentTarget.dataset.confirmClear))
	{
		tegaki.resize(document.getElementById('tegaki-width').value, document.getElementById('tegaki-height').value);
	}
});
window.onbeforeunload = function()
{
	// leaving page while tegaki was open
	if (
		'undefined' != typeof tegaki
		&& null != tegaki
	)
	{
		// safety save data was empty
		if (
			'undefined' == typeof tegaki.safety
			|| null == tegaki.safety
		)
		{
			localStorage.removeItem('tegakiSafety');
			return;
		}
		// store safety save data
		localStorage.tegakiSafety = window.JSON.stringify(tegaki.safety);
	}
};
