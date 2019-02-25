/*
** tegaki client by secret
** 0.2.6
**/
function nkTegaki()
{
	//check for jquery
	if ('undefined' == typeof $)
	{
		console.log('jQuery not loaded');
		return;
	}
	var instance = this;
	//version
	instance.version = function()
	{
		return '0.2.6';
	};
	instance.pushUndo = function()
	{
		//! console.log('pushing undo state');
		//push to undo buffer
		let undoImageData = instance.context.getImageData(
			0, 
			0,
			instance.width,
			instance.height
		);
		instance.undoHistory.push([undoImageData, instance.flipped]);
		instance.safetySave();
	};
	//simulate click for interface buttons
	instance.simulateClick = function(obj)
	{
		$(obj).addClass('active');
		setTimeout(function(){$(obj).removeClass('active')}, 60);
	};
	//color
	instance.formatColor = function(color)
	{
		if (3 == color.length)
		{
			color = color.substr(0, 1) + color.substr(0, 1) + color.substr(1, 1) + color.substr(1, 1) + color.substr(2, 1) + color.substr(2, 1);
		}
		return color;
	};
	instance.rgbToHex = function(rgb)
	{ 
		var hex = Number(rgb).toString(16);
		if (hex.length < 2) {
			hex = '0' + hex;
		}
		return hex;
	};
	instance.fullColorHex = function(r, g, b)
	{
		let red = instance.rgbToHex(r);
		let green = instance.rgbToHex(g);
		let blue = instance.rgbToHex(b);
		return red + green + blue;
	}
	instance.checkColor = function(color)
	{
		//check that new color is a valid hex color string
		if (
			color.match(/[^a-f0-9]/) 
			|| (
				6 != color.length 
				&& 3 != color.length
			)
		)
		{
			console.log('invalid hex color: ' + color);
			return -1;
		}
		return 0;
	};
	instance.changeColor = function(color)
	{
		console.log('color change to #' + color);
		if (0 < instance.checkColor(color))
		{
			return;
		}
		//set new color
		instance.color.fore = instance.formatColor(color);
		instance.color.redComponent = parseInt(instance.color.fore.substr(0, 2), 16);
		instance.color.greenComponent = parseInt(instance.color.fore.substr(2, 2), 16);
		instance.color.blueComponent = parseInt(instance.color.fore.substr(4, 2), 16);
		//rebuilt shape and tone interfaces
		instance.loadShapes(instance.shapes);
		instance.loadTones(instance.tones);
		instance.changeTool();
		instance.changeTone();
		instance.container.dispatchEvent(instance.event.changeColor);
	};
	//cursor update
	instance.updateCursor = function()
	{
		//get real position
		instance.cursor.x = Math.floor(instance.cursor.pageX - $(instance.canvas).offset().left);
		instance.cursor.y = Math.floor(instance.cursor.pageY - $(instance.canvas).offset().top);
		if (
			instance.cursor.x < 0 
			|| instance.cursor.x >= instance.width 
			|| instance.cursor.y < 0 
			|| instance.cursor.y >= instance.height
		)
		{
			return;
		}
	};
	//input
	instance.startInput = function()
	{
		if (instance.tools.eyedropper == instance.currentTool)
		{
			instance.eyedropperPick(instance.cursor.x, instance.cursor.y);
			return;
		}
		if (instance.tools.fill == instance.currentTool)
		{
			//! needs to push fill action to stroke buffer maybe?
			instance.pushUndo();
			let fillCanvas = document.createElement('canvas');
			fillCanvas.width = instance.width;
			fillCanvas.height = instance.height;
			let fillContext = fillCanvas.getContext('2d');
			let fillData = instance.context.getImageData(0, 0, instance.width, instance.height);
			let pixel = instance.context.getImageData(instance.cursor.x, instance.cursor.y, 1, 1);
			if (
				instance.color.redComponent != pixel.data[0]
				|| instance.color.greenComponent != pixel.data[1]
				|| instance.color.blueComponent != pixel.data[2]
				|| 255 != pixel.data[3]
			)
			{
				instance.queueFill(fillData, instance.cursor.x, instance.cursor.y, pixel.data[0], pixel.data[1], pixel.data[2], pixel.data[3])
				//! instance.recursiveFill(fillData, instance.cursor.x, instance.cursor.y, pixel.data[0], pixel.data[1], pixel.data[2], pixel.data[3])
				fillContext.globalCompositeOperation = 'source-over';
				fillContext.putImageData(fillData, 0, 0);
				instance.context.drawImage
				(
					fillCanvas,
					0,
					0
				);
			}
			fillCanvas = null;
			fillContext = null;
			fillData = null;
			return;
		}
		instance.input = true;
		//! console.log('starting input');
		//starting new buffer
	};
	instance.cancelInput = function()
	{
		console.log('cancelling current input');
		if (
			instance.tools.marquee == instance.currentTool 
			|| instance.tools.lasso == instance.currentTool 
			|| instance.tools.wand == instance.currentTool
		)
		{
			console.log('cancelling select action');
		}
		else if (
			instance.tools.eraser == instance.currentTool 
			|| instance.tools.brush == instance.currentTool
		)
		{
			console.log('cancelling current stroke');
		}
		instance.finishInput();
		instance.undo();
	};
	instance.updateInput = function()
	{
		if (!instance.input)
		{
			return;
		}
		if (
			instance.tools.brush == instance.currentTool 
			|| instance.tools.eraser == instance.currentTool
		)
		{
			instance.updateStroke();
			instance.paint(instance.cursor.x, instance.cursor.y);
			return;
		}
	};
	instance.finishInput = function()
	{
		if (!instance.input)
		{
			return;
		}
		console.log('finishing input');
		instance.input = false;
		if (
			instance.tools.brush == instance.currentTool 
			|| instance.tools.eraser == instance.currentTool
		)
		{
			instance.strokeHistory.push(instance.strokeBuffer);
			instance.strokeBuffer = [];
			return;
		}
		//!other tools finish input here
		//!
	};
	//stroke
	instance.updateStroke = function()
	{
		if (instance.tools.fill == instance.currentTool)
		{
			return;
		}
		if (0 == instance.strokeBuffer.length)
		{
			//! console.log('in update stroke with no current strokebuffer');
			instance.pushUndo();
			instance.strokeBuffer.push([instance.currentTool, instance.currentShape[instance.currentTool], instance.flipped]);
		}
		else
		{
			//!check outside of canvas according to tool shape
			//outside canvas
			if (
				instance.cursor.x < 0 
				|| instance.cursor.x >= instance.width 
				|| instance.cursor.y < 0 
				|| instance.cursor.y >= instance.height
			)
			{
				//last known was also outside canvas
				//!was all && before, but it should be || ?
				if (
					instance.cursor.lastX < 0 
					|| instance.cursor.lastX >= instance.width 
					|| instance.cursor.lastY < 0 
					|| instance.cursor.lastY >= instance.height
				)
				{
					//set last known coords and return
					instance.cursor.lastX = instance.cursor.x;
					instance.cursor.lastY = instance.cursor.y;
					return;
				}
			}
			//!doesn't need to pass anything to interpolate
			instance.interpolate(instance.cursor.x, instance.cursor.y, instance.cursor.lastX, tegaki.cursor.lastY);
		}
		instance.strokeBuffer.push([instance.cursor.x, instance.cursor.y]);
		//set last known coords
		instance.cursor.lastX = instance.cursor.x;
		instance.cursor.lastY = instance.cursor.y;
	};
	//paint
	instance.paint = function(x, y)
	{
		//!console.log('painting at ' + x + ',' + y + ' with tool ' + instance.currentTool + ', shape: ' + instance.currentShape[instance.currentTool]);
		var upperLeftX = (x - instance.shapes[instance.currentShape[instance.currentTool]].hotspot[0]);
		var upperLeftY = (y - instance.shapes[instance.currentShape[instance.currentTool]].hotspot[1]);
		switch (instance.currentTool)
		{
			//brush
			case 0:
				instance.context.globalCompositeOperation = 'source-over';
				//paint to current layer
				break;
			//eraser
			case 1:
				instance.context.globalCompositeOperation = 'destination-out';
				//erase from current layer
				break;
		}
		if (
			0 == instance.currentTone[instance.currentTool]
			&& 0 == instance.colorMask.state
		)
		{
			instance.context.drawImage
			(
				instance.shapeMask,
				upperLeftX, 
				upperLeftY
			);
			return;
		}
		//loop through tool edge x tool edge array and build shape for canvas masking out tone pixels and masked/remasked color pixels
		var currentShapeData = instance.shapes[instance.currentShape[instance.currentTool]];
		instance.shapeToneCanvas.width = currentShapeData.edge;
		instance.shapeToneCanvas.height = currentShapeData.edge;
		let currentCanvasData = instance.context.getImageData(upperLeftX, upperLeftY, currentShapeData.edge, currentShapeData.edge);
		var shapeToneData = instance.shapeToneContext.createImageData(currentShapeData.edge, currentShapeData.edge);
		for (var i = 0; i < currentShapeData.edge; i++)
		{
			var rowIndex = (i * currentShapeData.edge);
			for (var j = 0; j < currentShapeData.edge; j++)
			{
				//tonestate at current pixel was 1 and shapemask at current pixel was 1
				if (
					1 == currentShapeData.data[rowIndex + j] 
					&& 1 == instance.toneMask[((upperLeftY + i) * instance.width) + upperLeftX + j]
				)
				{
					var index = ((rowIndex + j) * 4);
					// mask or remask enabled
					if (0 != instance.colorMask.state)
					{
						// mask enabled
						if (1 == instance.colorMask.state)
						{
							// color in actual canvas at current position was the remask color
							if (
								instance.colorMask.redComponent == currentCanvasData.data[index]
								&& instance.colorMask.greenComponent == currentCanvasData.data[index + 1]
								&& instance.colorMask.blueComponent == currentCanvasData.data[index + 2]
								&& 255 == currentCanvasData.data[index + 3]
							)
							{
								// skip adding current pixel in shapeToneData
								continue;
							}
						}
						// remask enabled
						if (2 == instance.colorMask.state)
						{
							// color in actual canvas at current position was not the remask color
							if (
								instance.colorMask.redComponent != currentCanvasData.data[index]
								|| instance.colorMask.greenComponent != currentCanvasData.data[index + 1]
								|| instance.colorMask.blueComponent != currentCanvasData.data[index + 2]
								|| 255 != currentCanvasData.data[index + 3]
							)
							{
								// skip adding current pixel in shapeToneData
								continue;
							}
						}
					}
					//write shapemask imagedata pixel
					shapeToneData.data[index] = instance.color.redComponent;
					shapeToneData.data[index + 1] = instance.color.greenComponent;
					shapeToneData.data[index + 2] = instance.color.blueComponent;
					shapeToneData.data[index + 3] = 255;
				}
			}
		}
		instance.shapeToneContext.putImageData(shapeToneData, 0, 0);
		instance.context.drawImage
		(
			instance.shapeToneCanvas,
			upperLeftX, 
			upperLeftY
		);
	};
	instance.interpolate = function()
	{
		//check for step distance
		var difX = (instance.cursor.x < instance.cursor.lastX ? (instance.cursor.lastX - instance.cursor.x) : (-1 * (instance.cursor.x - instance.cursor.lastX)));
		var difY = (instance.cursor.y < instance.cursor.lastY ? (instance.cursor.lastY - instance.cursor.y) : (-1 * (instance.cursor.y - instance.cursor.lastY)));
		var absDifX = Math.abs(difX);
		var absDifY = Math.abs(difY);
		//!console.log('interpolation check, (absDifX: ' + absDifX + ' > ' + instance.step + ') || (absDifY: ' + absDifY + ' > ' + instance.step + ')');
		//!console.log('might interpolate between (' + instance.cursor.x + ',' + instance.cursor.y + ') and (' + instance.cursor.lastX + ',' + instance.cursor.lastY + ')');
		if (
			absDifX > instance.step 
			|| absDifY > instance.step
		)
		{
			//!console.log('interpolating');
			//fill in missing steps
			var steps = Math.floor((absDifX > absDifY ? absDifX : absDifY) / instance.step);
			var interpX = 0;
			var interpY = 0;
			var stepX = (difX / steps);
			var stepY = (difY / steps);
			//dconsole.log('interpolating for ' + steps + ' steps, (' + stepX + ',' + stepY + ') apart');
			for (var i = 0; i <= steps; i++)
			{
				interpX = Math.floor(instance.cursor.x + (stepX * i));
				interpY = Math.floor(instance.cursor.y + (stepY * i));
				if (
					instance.tools.brush == instance.currentTool 
					|| instance.tools.eraser == instance.currentTool
				)
				{
					instance.paint(interpX, interpY);
				}
				//!other tools that use interpolation here eventually
			}
		}
	};
	//eyedropper
	instance.eyedropperPick = function(x, y)
	{
		let pixel = instance.context.getImageData(x, y, 1, 1);
		if (255 != pixel.data[3])
		{
			instance.changeColor('ffffff');
			return;
		}
		instance.changeColor(instance.fullColorHex(pixel.data[0], pixel.data[1], pixel.data[2]));
	};
	//fill
	instance.fillPixel = function(
		index,
		targetRedComponent, targetBlueComponent, targetGreenComponent, targetAlphaComponent,
		fillRedComponent, fillBlueComponent, fillGreenComponent, fillAlphaComponent,
		fillData
	)
	{
		// color at index is already fill
		if (
			fillRedComponent == fillData.data[index]
			&& fillGreenComponent == fillData.data[index + 1]
			&& fillBlueComponent == fillData.data[index + 2]
			&& 255 == fillData.data[index + 3]
		)
		{
			return false;
		}
		// color at index is not target
		if (
			targetRedComponent != fillData.data[index]
			|| targetGreenComponent != fillData.data[index + 1]
			|| targetBlueComponent != fillData.data[index + 2]
			|| targetAlphaComponent != fillData.data[index + 3]
		)
		{
			return false;
		}
		fillData.data[index] = fillRedComponent;
		fillData.data[index + 1] = fillGreenComponent;
		fillData.data[index + 2] = fillBlueComponent;
		fillData.data[index + 3] = fillAlphaComponent;
		return true;
	};
	instance.queueFill = function(
		fillData,
		x, y,
		targetRedComponent, targetGreenComponent, targetBlueComponent, targetAlphaComponent
	)
	{
		let queue = [];
		queue.push([x, y]);
		while (0 < queue.length)
		{
			let coords = queue.pop();
			let x = coords[0];
			let y = coords[1];
			//! console.log('in fill queue for ' + x + ', ' + y);
			// out of bounds
			if (
				0 > x
				|| x >= instance.width
				|| 0 > y
				|| y >= instance.height
			)
			{
				continue;
			}
			let rowIndex = y * instance.width;
			let index = ((rowIndex + x) * 4);
			if (
				! instance.fillPixel(
					index,
					targetRedComponent, targetBlueComponent, targetGreenComponent, targetAlphaComponent,
					instance.color.redComponent, instance.color.blueComponent, instance.color.greenComponent, 255,
					fillData
				)
			)
			{
				continue;
			}
			queue.push([x, (y - 1)]);
			queue.push([x, (y + 1)]);
			queue.push([(x - 1), y]);
			queue.push([(x + 1), y]);
		}
	};
	instance.recursiveFill = function(fillData, x, y, targetRedComponent, targetGreenComponent, targetBlueComponent, targetAlphaComponent)
	{
		if (
			0 > x
			|| x >= instance.width
			|| 0 > y
			|| y >= instance.height
		)
		{
			return;
		}
		let index = (((y * instance.width) + x) * 4);
		if (
			instance.color.redComponent == fillData.data[index]
			&& instance.color.greenComponent == fillData.data[index + 1]
			&& instance.color.blueComponent == fillData.data[index + 2]
			&& 255 == fillData.data[index + 3]
		)
		{
			return;
		}
		if (
			targetRedComponent != fillData.data[index]
			|| targetGreenComponent != fillData.data[index + 1]
			|| targetBlueComponent != fillData.data[index + 2]
			|| targetAlphaComponent != fillData.data[index + 3]
		)
		{
			return;
		}
		fillData.data[index] = instance.color.redComponent;
		fillData.data[index + 1] = instance.color.greenComponent;
		fillData.data[index + 2] = instance.color.blueComponent;
		fillData.data[index + 3] = 255;
		instance.recursiveFill(fillData, x + 1, y, targetRedComponent, targetGreenComponent, targetBlueComponent, targetAlphaComponent);
		instance.recursiveFill(fillData, x - 1, y, targetRedComponent, targetGreenComponent, targetBlueComponent, targetAlphaComponent);
		instance.recursiveFill(fillData, x, y + 1, targetRedComponent, targetGreenComponent, targetBlueComponent, targetAlphaComponent);
		instance.recursiveFill(fillData, x, y - 1, targetRedComponent, targetGreenComponent, targetBlueComponent, targetAlphaComponent);
	};
	//build tone mask array
	instance.buildToneMask = function()
	{
		//! console.log('building tone mask array');
		if (
			'undefined' == typeof instance.currentTool 
			|| 'undefined' == typeof instance.currentTone[instance.currentTool] 
			|| 'undefined' == typeof instance.tones[instance.currentTone[instance.currentTool]])
		{
			return -1;
		}
		if (!instance.currentTool in instance.currentTone)
		{
			//! console.log('tone mask has no meaning for current tool');
			return -2;
		}
		var toneRow = 0;
		var toneCol = 0;
		instance.toneMask = [instance.width * instance.height];
		//for each row of the canvas
		for (var i = 0; i < instance.height; i++)
		{
			//for each col of the canvas
			for (var j = 0; j < instance.width; j++)
			{
				var index = (i * instance.width) + j;
				instance.toneMask[index] = instance.tones[instance.currentTone[instance.currentTool]].data[(toneRow * instance.tones[instance.currentTone[instance.currentTool]].edge) + toneCol];
				toneCol++;
				if (toneCol == instance.tones[instance.currentTone[instance.currentTool]].edge)
				{
					toneCol = 0;
				}
			}
			toneRow++;
			if (toneRow == instance.tones[instance.currentTone[instance.currentTool]].edge)
			{
				toneRow = 0;
			}
		}
	};
	//build shape mask canvas
	instance.buildShapeMask = function()
	{
		//! console.log('building shape mask canvas');
		if (
			'undefined' == typeof instance.currentTool 
			|| 'undefined' == typeof instance.currentShape[instance.currentTool] 
			|| 'undefined' == typeof instance.shapes[instance.currentShape[instance.currentTool]])
		{
			return -1;
		}
		if (!instance.currentTool in instance.currentShape)
		{
			//! console.log('shape mask has no meaning for current tool');
			return -2;
		}
		console.log('building tool mask for tool ' + instance.currentTool + ', shape ' + instance.currentShape[instance.currentTool]);
		var currentShapeData = instance.shapes[instance.currentShape[instance.currentTool]];
		instance.shapeMask.width = currentShapeData.edge;
		instance.shapeMask.height = currentShapeData.edge;
		var shapeMaskContext = instance.shapeMask.getContext('2d');
		var shapeMaskData = shapeMaskContext.createImageData(currentShapeData.edge, currentShapeData.edge);
		//cursor imagedata
		var cursorData = shapeMaskContext.createImageData(currentShapeData.edge, currentShapeData.edge);
		var cursor = false;
		var insideCursor = false;
		let cursorValue = 0;
		let altCursorValue = 255;
		for (var i = 0; i < currentShapeData.edge; i++)
		{
			for (var j = 0; j < currentShapeData.edge; j++)
			{
				var currentPixel = (i * currentShapeData.edge) + j;
				var index = (currentPixel * 4);
				//shape data was 1
				if (1 == currentShapeData.data[currentPixel])
				{
					//write toolmask imagedata pixel
					shapeMaskData.data[index] = instance.color.redComponent;
					shapeMaskData.data[index + 1] = instance.color.greenComponent;
					shapeMaskData.data[index + 2] = instance.color.blueComponent;
					shapeMaskData.data[index + 3] = 255;
					// first row or first col or last row or last col or just entered shape area
					if (
						0 == i
						|| (currentShapeData.edge - 1) == i
						|| 0 == j
						|| (currentShapeData.edge - 1) == j
						|| ! insideCursor
					)
					{
						// cursor outline
						cursorData.data[index] = cursorValue;
						cursorData.data[index + 1] = cursorValue;
						cursorData.data[index + 2] = cursorValue;
						cursorData.data[index + 3] = 255;
					}
					// first row
					if (0 == i)
					{
						// do inside stroke to the bottom
						altIndex = index + (currentShapeData.edge * 4);
						cursorData.data[altIndex] = altCursorValue;
						cursorData.data[altIndex + 1] = altCursorValue;
						cursorData.data[altIndex + 2] = altCursorValue;
						cursorData.data[altIndex + 3] = 255;
					}
					// last row
					if ((currentShapeData.edge - 1) == i)
					{
						// do inside stroke to the top
						altIndex = index - (currentShapeData.edge * 4);
						cursorData.data[altIndex] = altCursorValue;
						cursorData.data[altIndex + 1] = altCursorValue;
						cursorData.data[altIndex + 2] = altCursorValue;
						cursorData.data[altIndex + 3] = 255;
					}
					// last col
					if ((currentShapeData.edge - 1) == j)
					{
						// do inside stroke to the left
						cursorData.data[index - 4] = altCursorValue;
						cursorData.data[index - 3] = altCursorValue;
						cursorData.data[index - 2] = altCursorValue;
						cursorData.data[index - 1] = 255;
					}
					// just entered
					if (! insideCursor)
					{
						// do inside stroke to the right
						cursorData.data[index + 4] = altCursorValue;
						cursorData.data[index + 5] = altCursorValue;
						cursorData.data[index + 6] = altCursorValue;
						cursorData.data[index + 7] = 255;
					}
					insideCursor = true;
				}
				// just left
				else if (insideCursor)
				{
					// cursor outline on previous pixel
					cursorData.data[index - 4] = cursorValue;
					cursorData.data[index - 3] = cursorValue;
					cursorData.data[index - 2] = cursorValue;
					cursorData.data[index - 1] = 255;
					// cursor inside stroke to the left
					if (
						cursorValue != cursorData.data[index - 8]
						|| 255 != cursorData.data[index - 5]
					)
					{
						cursorData.data[index - 8] = altCursorValue;
						cursorData.data[index - 7] = altCursorValue;
						cursorData.data[index - 6] = altCursorValue;
						cursorData.data[index - 5] = 255;
					}
					insideCursor = false;
				}
			}
			insideCursor = false;
		}
		//do cursor
		if (1 < currentShapeData.edge)
		{
			//hotspot pixel for cursor
			index = ((currentShapeData.hotspot[1] * currentShapeData.edge) + currentShapeData.hotspot[0]) * 4;
			cursorData.data[index] = cursorValue;
			cursorData.data[index + 1] = cursorValue;
			cursorData.data[index + 2] = cursorValue;
			cursorData.data[index + 3] = 255;
			shapeMaskContext.putImageData(cursorData, 0, 0);
			$(instance.workspace).css('cursor', 'url(' + instance.shapeMask.toDataURL() + ') ' + currentShapeData.hotspot[0] + ' ' + currentShapeData.hotspot[1] + ', default');
		}
		else
		{
			$(instance.workspace).css('cursor', 'default');
		}
		instance.shapeMask.width = currentShapeData.edge;
		instance.shapeMask.height = currentShapeData.edge;
		shapeMaskContext.putImageData(shapeMaskData, 0, 0);
	};
	//resize
	instance.resize = function(width, height)
	{
		//! console.log('resizing to ' + width + 'x' + height);
		//!save canvas state
		//!push resize event to event history
		//!clear canvas
		instance.canvas.width = width;
		instance.canvas.height = height;
		//!paste saved canvas state
		instance.width = width;
		instance.height = height;
		instance.buildToneMask();
		instance.container.dispatchEvent(instance.event.resize);
	};
	//presave
	instance.getPresaveDataUrl = function()
	{
		return instance.getPresaveCanvas().toDataURL();
	}
	instance.getPresaveCanvas = function()
	{
		var saveCanvas = document.createElement('canvas');
		saveCanvas.width = instance.width;
		saveCanvas.height = instance.height;
		var saveContext = saveCanvas.getContext('2d');
		saveContext.globalCompositeOperation = 'source-over';
		//retain flipped for saving since it's probably what the user expects, even if the flip is local when multiple users are present?
		/** /
		if (instance.flipped)
		{
			console.log('canvas was flipped, returning to normal before saving');
			instance.flip();
		}
		/**/
		saveContext.putImageData
		(
			instance.context.getImageData
			(
				0, 
				0,
				instance.width,
				instance.height
			),
			0,
			0
		);
		saveContext.globalCompositeOperation = 'destination-over';
		//! console.log('filling save canvas context destination-over with #' + instance.color.back);
		saveContext.fillStyle = '#' + instance.color.back;
		saveContext.fillRect
		(
			0, 
			0, 
			instance.width, 
			instance.height
		);
		return saveCanvas;
	};
	//tool change
	instance.changeTool = function(toolId)
	{
		if ('undefined' == typeof toolId)
		{
			toolId = instance.currentTool;
		}
		else if (instance.currentTool == toolId)
		{
			return;
		}
		//store previous tool
		instance.prevTool = instance.currentTool;
		instance.currentTool = toolId;
		for (var name in instance.tools)
		{
			if (toolId == instance.tools[name])
			{
				break;
			}
		}
		$('.nktTool').removeClass('selected');
		$(instance.menu.tool[name]).addClass('selected');
		//! console.log('changing tool to ' + toolId + '(' + name + ') from ' + instance.prevTool);
		//tool makes use of shape-size
		if (toolId in instance.currentShape)
		{
			instance.menu.control.shapeSlide.stepDown(instance.shapes.length);
			instance.menu.control.shapeSlide.stepUp(instance.currentShape[instance.currentTool]);
			$(instance.menu.control.shapeDisplay).text(instance.currentShape[instance.currentTool]);
			instance.buildShapeMask();
		}
		//tool makes use of tone
		if (toolId in instance.currentTone)
		{
			instance.buildToneMask();
			instance.changeTone(instance.currentTone[instance.currentTool]);
		}
		// clear workspace cursors
		instance.workspace.classList.remove('eyedropper');
		instance.workspace.classList.remove('fill');
		// eyedropper
		if (instance.tools.eyedropper == instance.currentTool)
		{
			//! switch to eyedropper cursor here
			$(instance.workspace).css('cursor', '');
			instance.workspace.classList.add('eyedropper');
		}
		// fill
		if (instance.tools.fill == instance.currentTool)
		{
			//! switch to fill bucket cursor here
			$(instance.workspace).css('cursor', '');
			instance.workspace.classList.add('fill');
		}
	};
	instance.changeShape = function(shapeId)
	{
		if (!instance.currentTool in instance.currentShape)
		{
			console.log('tool shape has no meaning for current tool');
			return -1;
		}
		if ('undefined' == typeof instance.shapes[shapeId])
		{
			console.log('shape ' + shapeId + ' not found for current shape pack');
			return -2;
		}
		//! console.log('changing shape to ' + shapeId + ' for current tool');
		$(instance.menu.control.shapeSlide).attr('value', 0);
		instance.menu.control.shapeSlide.stepDown(instance.shapes.length);
		instance.menu.control.shapeSlide.stepUp(shapeId);
		instance.currentShape[instance.currentTool] = shapeId;
		$(instance.menu.control.shapeDisplay).text(instance.currentShape[instance.currentTool]);
		instance.buildShapeMask();
	};
	instance.changeTone = function(toneId)
	{
		if (!instance.currentTool in instance.currentTone)
		{
			console.log('tool tone has no meaning for current tool');
			return -1;
		}
		if ('undefined' == typeof toneId)
		{
			toneId = instance.currentTone[instance.currentTool];
		}
		if ('undefined' == typeof instance.tones[toneId])
		{
			console.log('tone ' + toneId + ' not found for current tone pack');
			return -2;
		}
		$('.nktTone').removeClass('selected');
		$(instance.menu.tone[toneId]).addClass('selected');
		//! console.log('changing tone to ' + toneId + ' for current tool');
		instance.currentTone[instance.currentTool] = toneId;
		instance.buildToneMask();
	};
	//actions
	instance.pallette = function()
	{
		//! console.log('triggering pallette input');
		instance.palletteInput.click();
	}
	instance.flip = function()
	{
		//! console.log('flipping canvas');
		var input = instance.context.getImageData(0, 0, instance.width, instance.height);
		var output = instance.context.createImageData(instance.width, instance.height);
		var width = instance.width;
		var height = instance.height;
		var inputData = input.data;
		var outputData = output.data
		for (var y = 0; y <= height; y++)
		{
			for (var x = 0; x < width; x++)
			{
				var i = (((y - 1) * width) + x) * 4;
				var flip = (((y - 1) * width) + (width - x - 1)) * 4;
				for (var c = 0; c < 4; c++)
				{
					outputData[(i + c)] = inputData[(flip + c)];
				}
			}
		}
		instance.context.putImageData
		(
			output,
			0,
			0
		);
		instance.flipped = !tegaki.flipped;
		if (instance.flipped)
		{
			$(instance.container).addClass('flipped');
		}
		else
		{
			$(instance.container).removeClass('flipped');
		}
		instance.container.dispatchEvent(instance.event.flip);
	};
	instance.mask = function()
	{
		//! console.log('cycling mask');
		instance.colorMask.state++;
		if (2 < instance.colorMask.state)
		{
			instance.colorMask.state = 0;
		}
		let maskType = '';
		switch (instance.colorMask.state)
		{
			case 0:
				// no mask
				instance.menu.action.mask.classList.remove('in');
				instance.menu.action.mask.classList.remove('out');
				maskType = 'mask';
				break;
			case 1:
				// mask
				instance.menu.action.mask.classList.remove('in');
				instance.menu.action.mask.classList.add('out');
				maskType = 'maskOut';
				break;
			case 2:
				// remask
				instance.menu.action.mask.classList.remove('out');
				instance.menu.action.mask.classList.add('in');
				maskType = 'maskIn';
				break;
		}
		if (
			'undefined' != typeof instance.string.action[maskType]
			&& 'undefined' != typeof instance.string.action[maskType]
		)
		{
			instance.menu.action.mask.title = instance.string.action[maskType];
		}
	};
	instance.undo = function()
	{
		//! console.log('undo history length: ' + instance.undoHistory.length);
		if (1 > instance.undoHistory.length)
		{
			return -1;
		}
		//push to redo buffer
		var redoImageData = instance.context.getImageData(
			0, 
			0,
			instance.width,
			instance.height
		);
		instance.redoHistory.push([redoImageData, instance.flipped]);
		//unwind last buffer in undo history
		var undoState = instance.undoHistory.pop();
		if (
			(
				undoState[1] 
				&& !instance.flipped
			) 
			|| (
				!undoState[1] 
				&& instance.flipped
			)
		)
		{
			instance.flip();
			instance.context.putImageData(undoState[0], 0, 0);
			instance.flip();
		}
		else
		{
			instance.context.putImageData(undoState[0], 0, 0);
		}
		instance.safetySave();
		//!if undo history size is larger than max undo levels then slice the earliest undo out of array
		instance.container.dispatchEvent(instance.event.undo);
	};
	instance.redo = function()
	{
		//! console.log('redo history length: ' + instance.redoHistory.length);
		if (1 > instance.redoHistory.length)
		{
			return -1;
		}
		//push to undo buffer
		instance.pushUndo();
		//unwind last buffer in redo history
		var redoState = instance.redoHistory.pop();
		if (! redoState)
		{
			return -1;
		}
		if (
			(
				redoState[1] 
				&& !instance.flipped
			) 
			|| (
				!redoState[1] 
				&& instance.flipped
			)
		)
		{
			instance.flip();
		}
		instance.context.putImageData(redoState[0], 0, 0);
		instance.safetySave();
		instance.container.dispatchEvent(instance.event.redo);
	}
	instance.save = function()
	{
		console.log('this is the default save handler. if you\'re seeing this message you did not provide a custom handler for remote saving to replace this placeholder');
	};
	instance.download = function()
	{
		console.log('local download');
		instance.getPresaveCanvas().toBlob(function(blob)
		{
			var url = window.URL.createObjectURL(blob);
			var link = document.createElement('a');
			link.href = url;
			link.download = 'tegaki.' + new Date().getTime() + '.png';
			link.click();
			window.URL.revokeObjectURL(url);
		}, 'image/png');
	};
	instance.wipe = function()
	{
		if (!window.confirm(instance.string.msg['confirmWipe'])) {
			return;
		}
		//clear canvas
		instance.context.clearRect
		(
			0, 
			0, 
			instance.width, 
			instance.height
		);
		//clear buffers
		instance.strokeBuffer = [];
		instance.strokeHistory = [];
		instance.undoHistory = [];
		instance.redoHistory = [];
		//clear safety
		instance.safetyClear();
		console.log('clearing canvas, undo/redo buffers, and safety');
		instance.container.dispatchEvent(instance.event.wipe);
	};
	//controls
	instance.shapeUp = function()
	{
		instance.changeShape(parseInt(instance.currentShape[instance.currentTool]) + 1);
	};
	instance.shapeDn = function()
	{
		instance.changeShape(parseInt(instance.currentShape[instance.currentTool]) - 1);
	};
	//headless shortcuts
	instance.swap = function()
	{
		instance.changeTool(instance.prevTool);
	};
	//modular resources
	instance.loadLanguage = function(languagePack)
	{
		if ('undefined' == typeof languagePack)
		{
			return;
		}
		instance.string = languagePack;
		//re-label interface
		if ('undefined' != typeof instance.string)
		{
			for (var submenu in instance.menu)
			{
				for (var item in instance.menu[submenu])
				{
					if (
						'undefined' != typeof instance.string[submenu]
						&& 'undefined' != typeof instance.string[submenu][item]
					)
					{
						instance.menu[submenu][item].title = instance.string[submenu][item];
					}
				}
			}
		}
	};
	instance.loadShapes = function(shapePack)
	{
		console.log('loading shape pack');
		if ('undefined' == typeof shapePack)
		{
			instance.shapes = 
			[
				{
					edge: 1,
					data: [1]
				}
			];
			return;
		}
		instance.shapes = shapePack;
		//!rebuild shape-size interface
		//!
		$(instance.menu.control.shapeSlide)
		.attr('max', (instance.shapes.length - 1));
	};
	instance.loadTones = function(tonePack)
	{
		if ('undefined' == typeof tonePack)
		{
			instance.tones = 
			[
				{
					edge: 1,
					data: [1]
				}
			];
			return;
		}
		console.log('loading tone pack');
		instance.tones = tonePack;
		//rebuild tone interface
		$('.nktTone').remove();
		instance.menu.tone = [];
		var toneCanvas = document.createElement('canvas');
		var toneContext = toneCanvas.getContext('2d');
		for (toneId in instance.tones)
		{
			toneCanvas.width = instance.tones[toneId].edge;
			toneCanvas.height = instance.tones[toneId].edge;
			//create background image for current tone
			var toneData = toneContext.createImageData(instance.tones[toneId].edge, instance.tones[toneId].edge);
			//for each row of the tone
			for (var i = 0; i < instance.tones[toneId].edge; i++)
			{
				//for each col of the tone
				for (var j = 0; j < instance.tones[toneId].edge; j++)
				{
					if (1 == instance.tones[toneId].data[(i * instance.tones[toneId].edge) + j])
					{
						var index = (((i * instance.tones[toneId].edge) + j) * 4);
						toneData.data[index] = instance.color.redComponent;
						toneData.data[index + 1] = instance.color.greenComponent;
						toneData.data[index + 2] = instance.color.blueComponent;
						toneData.data[index + 3] = 255;
					}
				}
			}
			toneContext.putImageData(toneData, 0, 0);
			instance.menu.tone[toneId] = document.createElement('span');
			$(instance.menu.tone[toneId])
			.addClass('nktTone')
			.css('background-image', 'url(' + toneCanvas.toDataURL() + ')')
			.attr('data-id', toneId)
			.appendTo(instance.toneMenu);
		}
	};
	instance.checkBinding = function(e, binding)
	{
		if (
			e.keyCode == binding[0] 
			//!maybe needs additional logic here
			&& (
				false == binding[1] 
				|| e.ctrlKey
			)
		)
		{
			return true;
		}
		return false;
	};
	instance.loadBindings = function(bindings)
	{
		if ('undefined' == typeof bindings)
		{
			instance.bindings = {};
			return;
		}
		console.log('loading key bindings');
		instance.bindings = bindings;
		//rebind keys
		$(window).keydown(function(e)
		{
			//tool
			for (name in instance.bindings.tool)
			{
				if (instance.checkBinding(e, instance.bindings.tool[name]))
				{
					instance.simulateClick($(instance.menu.tool[name]));
					instance.changeTool(instance.tools[name]);
				}
			}
			//action and control
			var submenus = ['action', 'control', 'headless'];
			for (i in submenus)
			{
				var submenu = submenus[i];
				for (name in instance.bindings[submenu])
				{
					if (instance.checkBinding(e, instance.bindings[submenu][name]))
					{
						instance.simulateClick($(instance.menu[submenu][name]));
						if ('undefined' == typeof instance[name])
						{
							return;
						}
						instance[name]();
					}
				}
			}
			//temporary modifier press
			//! hardcoded just for eyedropper with alt only currently
			if (18 == e.keyCode)
			{
				// store current tool in toolBuffer.key and swap to eyedropper
				instance.toolBuffer.key = instance.currentTool;
				instance.changeTool(instance.tools.eyedropper);
			}
		});
		$(window).keyup(function(e)
		{
			//temporary modifier release
			//! hardcoded just for eyedropper with alt only currently
			if (
				18 == e.keyCode
				&& null != instance.toolBuffer.key
			)
			{
				instance.changeTool(instance.toolBuffer.key);
				instance.toolBuffer.key = null;
			}
		});
	};
	instance.loadEvent = function(eventUrl)
	{
		console.log('load event goes here');
	};
	instance.detectColor = function()
	{
		console.log('attempting to determine color');
		var imgData = instance.context.getImageData(0, 0, instance.width, instance.height);
		var pix = imgData.data;
		var n = pix.length;
		for (var i = 0; i < n; i += 4)
		{
			var r = i;
			var g = i + 1;
			var b = i + 2;
			//if pixel is non-transparent and non-white then return that color
			if (
				pix[i + 3] != 0
				&& (
					pix[r] != 255 
					|| pix[g] != 255 
					|| pix[b] != 255
				)
			)
			{
				return ('0' + parseInt(pix[r]).toString(16)).slice(-2) + ('0' + parseInt(pix[g]).toString(16)).slice(-2) + ('0' + parseInt(pix[b]).toString(16)).slice(-2);
			}
		}
		return '000000';
	};
	instance.loadImage = function(imageUrl, loadImageCallback)
	{
		console.log('loading external image');
		var img = new Image();
		img.crossOrigin = 'anonymous';
		img.onload = function()
		{
			instance.resize(img.width, img.height);
			instance.context.drawImage(img, 0, 0);
			//clear all white from image to leave just the ink
			var detectedColor = null;
			var imgData = instance.context.getImageData(0, 0, instance.width, instance.height);
			var pix = imgData.data;
			var clear = {r:0, g:0, b:0, a:0};
			var n = pix.length;
			for (var i = 0; i < n; i += 4)
			{
				var r = i;
				var g = i + 1;
				var b = i + 2;
				//if pixel is white then set to transparent
				if (
					pix[r] == 255 
					&& pix[g] == 255 
					&& pix[b] == 255
				)
				{
					pix[r] = clear.r;
					pix[g] = clear.g;
					pix[b] = clear.b;
					pix[i + 3] = clear.a;
				}
			}
			instance.context.putImageData(imgData, 0, 0);
			if ('undefined' != typeof loadImageCallback)
			{
				loadImageCallback();
			}
		};
		img.src = imageUrl;
	};
	//safety saving
	instance.safetySave = function()
	{
		console.log('safety save');
		instance.safety = {
			flipped: instance.flipped,
			width: instance.width,
			height: instance.height,
			color: instance.color.fore,
			data: tegaki.canvas.toDataURL()
		};
	};
	instance.safetyClear = function()
	{
		instance.safety = null;
	}
	instance.safetyRestore = function(safety)
	{
		console.log('safety restore');
		instance.resize(safety['width'], safety['height']);
		if (safety['flipped'])
		{
			instance.flip();
		}
		instance.loadImage(safety['data'], function()
		{
			instance.changeColor(instance.detectColor());
		});
	};
	instance.rebind = function(category, name)
	{
		if (
			'undefined' == typeof instance.string
			|| 'undefined' == typeof instance.string.msg
			|| 'undefined' == typeof instance.string.msg['bindingCtrl']
			|| 'undefined' == typeof instance.string.msg['bindingKeycode']
			|| 'undefined' == typeof instance.string.msg['bindingRemoved']
			|| 'undefined' == typeof instance.string.msg['bindingNew']
		)
		{
			//no sense bringing up rebind prompts if there's no message to tell the user what to do
			return;
		}
		//things that don't make sense to have bindings
		if (
			'shapeDisplay' == name 
			|| 'shapeSlide' == name
		)
		{
			return -1;
		}
		var existingKeycode = '';
		//binding for this category and name exists
		if (
			'undefined' != typeof instance.bindings[category]
			&& 'undefined' != typeof instance.bindings[category][name]
		)
		{
			existingKeycode = String.fromCharCode(instance.bindings[category][name][0]);
		}
		var newCtrl = window.confirm(instance.string.msg['bindingCtrl']);
		var newKey = window.prompt(instance.string.msg['bindingKeycode'], existingKeycode);
		if (null == newKey)
		{
			return;
		}
		newKey = newKey.toUpperCase();
		var newKeycode = newKey.charCodeAt(0);
		if (false == newCtrl)
		{
			var ctrlString = '';
		}
		else
		{
			newCrtl = true;
			var ctrlString = 'ctrl+';
		}
		var unbindString = '';
		//loop through existing bindings
		for (submenu in instance.bindings)
		{
			for (existingBind in instance.bindings[submenu])
			{
				//skip if we're on the binding being changed
				if (
					category == submenu 
					&& existingBind == name
				)
				{
					continue;
				}
				//check if shortcut is currently in use for another binding
				if (
					instance.bindings[submenu][existingBind][0] == newKeycode 
					&& instance.bindings[submenu][existingBind][1] == newCtrl
				)
				{
					//clear that binding
					instance.bindings[submenu][existingBind] = [0, false];
					unbindString = instance.string.msg['bindingRemoved'] + instance.string[submenu][existingBind];
					break;
				}
			}
		}
		instance.bindings[category][name] = [newKeycode, newCtrl];
		alert(instance.string.msg['bindingNew'] + instance.string[category][name] + ': ' + ctrlString + newKey.substring(0, 1) + unbindString);
	};
	//initialization
	(function()
	{
		console.log('initializing tegaki');
		instance.width = 0; //canvas width
		instance.height = 0; //canvas height
		instance.input = false;//input button
		instance.modifier = false;//modifier button
		instance.flipped = false; //local canvas is flipped
		instance.colorMask = {
			state: 0, // no mask/mask out/mask in
			redComponent: 0,
			greenComponent: 0,
			blueComponent: 0,
		};
		instance.step = 1; //distance for interpolation
		instance.color = 
		{
			fore: '000000',
			back: 'ffffff',
			redComponent: 0,
			blueComponent: 0,
			greenComponent: 0
		};
		instance.strokeBuffer = []; //current stroke buffer for ongoing stroke
		instance.strokeHistory = []; //array of stroke buffers for entire event
		instance.undoLevels = 64; //max number of undos to store
		instance.undoHistory = []; //array of canvas states for undo history
		instance.redoHistory = []; //array of canvas states for redo history after undo
		instance.event = 
		{
			finishInput: new Event('finishInput'),
			flip: new Event('flip'),
			maskNone: new Event('maskNone'),
			maskOut: new Event('maskOut'),
			maskIn: new Event('maskIn'),
			undo: new Event('undo'),
			redo: new Event('redo'),
			wipe: new Event('wipe'),
			resize: new Event('resize'),
			changeColor: new Event('changeColor'),
		}; //events
		//!maybe layers someday
		//!instance.layer = []; //array of layer canvases
		//!instance.layerContext = []; //array of layer contexts
		instance.toolBuffer = {
			mouse: null,
			key: null,
		};
		instance.currentTool; //id of current tool
		instance.currentShape = 
		{
			0: 0, //brush
			1: 0 //eraser
		}; //list of current tool shape-sizes for tools that use them
		instance.currentTone = 
		{
			0: 0, //brush
			1: 0 //eraser
		}; //list of current tool tones for tools that use them
		instance.cursor = 
		{
			pageX: 0, //pagewide x position
			pageY: 0, //pagewide y position
			x: 0, //actual x position
			y: 0 //actual y position
		};
		instance.tools = 
		{
			brush: 0,
			eraser: 1,
			eyedropper: 2,
			fill: 3,
			/** /
			zoom: 4,
			marquee: 5,
			lasso: 6,
			wand: 7,
			move: 8,
			gradient: 9,
			jumble: 10,
			/**/
		};
		instance.safety; //safety save image data
		instance.toneMask = []; //mask for current tone
		instance.shapeMask = document.createElement('canvas'); //representation of shape for current shape-size
		//create structural elements
		console.log('creating structural elements');
		//container
		instance.container = document.createElement('div');
		instance.container.id = 'nkTegaki';
		//menu
		console.log('creating menus');
		instance.menu = 
		{
			tool: 
			{
				brush: 'span',
				eraser: 'span',
				eyedropper: 'span',
				fill: 'span',
				/** /
				zoom: 'span',
				marquee: 'span',
				lasso: 'span',
				wand: 'span',
				move: 'span',
				gradient: 'span',
				jumble: 'span',
				/**/
			},
			action: 
			{
				flip: null,
				mask: null,
				undo: null,
				redo: null,
				save: null,
				download: null,
				wipe: null
			},
			control:
			{
				shapeDn: null,
				shapeUp: null,
				pallette: null
			}
		};
		instance.menuContainer = document.createElement('div');
		instance.menuContainer.id = 'nktMenu';
		$(instance.menuContainer).appendTo(instance.container);
		for (var submenu in instance.menu)
		{
			var submenuUpper = submenu.charAt(0).toUpperCase() + submenu.slice(1);
			instance['menu' + submenuUpper] = document.createElement('div');
			instance['menu' + submenuUpper].id = 'nktMenu' + submenuUpper;
			$(instance['menu' + submenuUpper]).appendTo(instance.menuContainer);
			for (var i in instance.menu[submenu])
			{
				var item = document.createElement('span');
				$(item)
				.addClass('nkt' + submenuUpper)
				.addClass(submenu + i.charAt(0).toUpperCase() + i.slice(1))
				.attr('data-name', i)
				.attr('data-category', submenu);
				$(item).appendTo(instance['menu' + submenuUpper]);
				instance.menu[submenu][i] = item;
			}
			$(document.createElement('br')).appendTo(instance.menuContainer);
		}
		//action pallete
		instance.palletteInput = document.createElement('input');
		instance.palletteInput.id = 'palletteInput';
		$(instance.palletteInput)
		.attr('type', 'color')
		.attr('value', '#000000')
		.prependTo(instance.menuContainer);
		//control shape display/slider
		instance.menu.control.shapeSlide = document.createElement('input');
		$(instance.menu.control.shapeSlide)
		.addClass('controlShapeSlide')
		.attr('type', 'range')
		.attr('step', 1)
		.attr('min', 0)
		.prependTo(instance.menuControl);
		instance.menu.control.shapeDisplay = document.createElement('span');
		$(instance.menu.control.shapeDisplay)
		.addClass('controlShapeDisplay')
		.prependTo(instance.menuControl);
		//tone container
		instance.toneMenu = document.createElement('div');
		instance.toneMenu.id = 'nktMenuTone';
		$(instance.toneMenu).appendTo(instance.menuContainer);
		//interface tool button clicks
		$(instance.menuContainer).on('mousedown', '.nktTool', function(e)
		{
			var name = $(this).attr('data-name');
			if (3 == e.which)
			{
				instance.rebind('tool', name);
				return;
			}
			instance.changeTool(instance.tools[name]);
		});
		//interface action and control button clicks
		$(instance.menuContainer).on('mousedown', '.nktAction, .nktControl', function(e)
		{
			var name = $(this).attr('data-name');
			if (3 == e.which)
			{
				if ('mask' == name)
				{
					// set mask color to current color
					instance.colorMask.redComponent = instance.color.redComponent;
					instance.colorMask.greenComponent = instance.color.greenComponent;
					instance.colorMask.blueComponent = instance.color.blueComponent;
					e.currentTarget.style.backgroundColor = instance.color.fore;
					return;
				}
				instance.rebind($(this).attr('data-category'), name);
				return;
			}
			if ('undefined' == typeof instance[name])
			{
				return;
			}
			instance[name]();
		});
		//interface action pallette
		$(instance.palletteInput)[0].addEventListener('change', function(e)
		{
			instance.changeColor($(this).val().substr(1));
			/** /
			//convert existing paint to new color
			instance.context.globalCompositeOperation = 'source-in';
			instance.context.fillStyle = '#' + instance.color.fore;
			instance.context.fillRect
			(
				0, 
				0, 
				instance.width, 
				instance.height
			);
			/**/
		});
		//interface control shape slider
		$(instance.menu.control.shapeSlide)[0].addEventListener('input', function(e)
		{
			instance.changeShape($(this).val());
		});
		//interface tone button clicks
		$(instance.toneMenu).on('click', '.nktTone', function()
		{
			instance.changeTone($(this).attr('data-id'));
		});
		//workspace
		instance.workspace = document.createElement('div');
		instance.workspace.id = 'nktWorkspace';
		$(instance.workspace).appendTo(instance.container);
		//canvas
		instance.canvas = document.createElement('canvas');
		instance.canvas.id = 'nktCanvas';
		$(instance.canvas).appendTo(instance.workspace);
		instance.context = instance.canvas.getContext('2d');
		//shapemask with tone
		instance.shapeToneCanvas = document.createElement('canvas');
		instance.shapeToneContext = instance.shapeToneCanvas.getContext('2d');
		//resize
		instance.resize(1, 1);
		//listeners for workspace clicks
		console.log('registering listeners for workspace clicks');
		instance.inputDown = function(x, y)
		{
			//touch input additions by paru
			instance.cursor.pageX = x;
			instance.cursor.pageY = y;
			instance.updateCursor();
			//start input
			instance.startInput();
			//do first input update
			instance.updateInput();
		};
		instance.inputUp = function()
		{
			if (instance.input)
			{
				instance.finishInput();
				instance.container.dispatchEvent(instance.event.finishInput);
			}
		};
		instance.inputMove = function(x, y)
		{
			instance.cursor.pageX = x;
			instance.cursor.pageY = y;
			instance.updateCursor();
			if (!instance.input)
			{
				return;
			}
			instance.updateInput();
		};
		$(instance.workspace).mousedown(function(e)
		{
			e.preventDefault();
			//already doing a stroke, cancel it
			if (instance.input) // && 2 == e.button
			{
				instance.cancelInput();
				return;
			}
			if (
				2 == e.button
				&& instance.currentTool != instance.tools.eyedropper
			)
			{
				// store current tool in toolBuffer.mouse and swap to eyedropper
				instance.toolBuffer.mouse = instance.currentTool;
				instance.changeTool(instance.tools.eyedropper);
			}
			instance.inputDown(e.pageX, e.pageY);
		});
		$(document).mouseup(function()
		{
			instance.inputUp();
			if (null != instance.toolBuffer.mouse)
			{
				instance.changeTool(instance.toolBuffer.mouse);
				instance.toolBuffer.mouse = null;
			}
		});
		//listeners for workspace movement
		console.log('registering listeners for workspace movement');
		$(instance.workspace).mousemove(function(e)
		{
			instance.inputMove(e.pageX, e.pageY);
		});
		//listeners for touch
		$(instance.workspace).on('touchstart', function(e)
		{
			e.preventDefault();
			instance.inputDown(e.touches[0].pageX, e.touches[0].pageY)
		});
		$(instance.workspace).on('touchend', function(e)
		{
			e.preventDefault();
			instance.inputUp();
		});
		$(instance.workspace).on('touchmove', function(e)
		{
			e.preventDefault();
			instance.inputMove(e.touches[0].pageX, e.touches[0].pageY);
		});
		//initial color
		instance.changeColor('000');
		//disable normal right click behavior over container
		instance.container.oncontextmenu = function()
		{
			return false;
		};
	}());
	return instance;
}