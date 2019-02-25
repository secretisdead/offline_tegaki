function fetchTegakiPack(packUrl, packHandler, callback)
{
	$.ajax(
	{
		url: packUrl,
		data: '',
		cache: false,
		contentType: false,
		processData: false,
		type: 'get'
	})
	.done(function(data)
	{
		if ('' == data)
		{
			return;
		}
		//console.log(data);
		packHandler(data);
		callback();
	})
	.fail(function()
	{
		console.log('problem loading remote tegaki resource pack: ' + packUrl);
	});
}
function createTegaki(
	resourceLocation,
	language,
	shapePack,
	tonePack,
	bindings,
	callback
)
{
	let tegaki = new nkTegaki();
	// resource load chain
	// language
	fetchTegakiPack(resourceLocation + 'language.' + language + '.json', tegaki.loadLanguage, function()
	{
		// shape pack
		fetchTegakiPack(resourceLocation + 'shape.' + shapePack + '.json', tegaki.loadShapes, function()
		{
			// tone pack
			fetchTegakiPack(resourceLocation + 'tone.' + tonePack + '.json', tegaki.loadTones, function()
			{
				// key bindings followed by adding to hierarchy
				fetchTegakiPack(resourceLocation + 'binding.' + bindings + '.json', tegaki.loadBindings, function()
				{
					callback(tegaki);
				});
			});
		});
	});
};
