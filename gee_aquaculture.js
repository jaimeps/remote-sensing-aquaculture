
// Author: Jaime Pastor

///////////////////////////////////////////////////////////////////////////
// DEFINE AREA OF INTEREST AND REGIONS FOR CLASSIFICATION

// Import USGS Landsat 5 TM Raw Scenes (Orthorectified)
var l5raw = ee.ImageCollection("LANDSAT/LT5_L1T");

// Sample aquaculture area for training
var aquaculture = ee.FeatureCollection([
  ee.Feature(ee.Geometry.Rectangle(104.732, 8.622, 104.722, 8.612)).set('class', 0),
  ee.Feature(ee.Geometry.Rectangle(104.817, 8.691, 104.807, 8.681)).set('class', 0)
  ]);

// Sample water area for training
var water = ee.FeatureCollection([
  ee.Feature(ee.Geometry.Rectangle(104.73, 8.70, 104.72, 8.69)).set('class', 1),
  ee.Feature(ee.Geometry.Rectangle(104.72, 8.58, 104.71, 8.57)).set('class', 1),
  ee.Feature(ee.Geometry.Rectangle(104.86, 8.693, 104.85, 8.692)).set('class', 1)
  ]);

// Sample vegetation area for training
var vegetation = ee.FeatureCollection([
  ee.Feature(ee.Geometry.Rectangle(104.785, 8.62, 104.775, 8.61)).set('class', 2),
  ee.Feature(ee.Geometry.Rectangle(104.83, 8.7, 104.825, 8.695)).set('class', 2)
  ]);

// Add to map
Map.addLayer(aquaculture, {color:'FF0000'}, 'AQUACULTURE');
Map.addLayer(vegetation, {color: '0B3B17'}, 'VEGETATION');
Map.addLayer(water, {color: '0404B4'}, 'WATER');
 
// Region of interest: A subarea in South Vietnam
var subarea = ee.Geometry.Rectangle(104.89, 8.73, 104.7, 8.55);
Map.addLayer(subarea, {color: 'fafafa', opacity: .01}, 'RECTANGLE');

///////////////////////////////////////////////////////////////////////////
// ADDING FALSE COLOR IMAGE OF THE REGION OF INTEREST

// Dates
var start = '2004-01-01';
var end = '2005-12-31';

// Center map
Map.centerObject(subarea, 11);

// Filter image
var image = ee.Algorithms.Landsat.simpleComposite({
  collection: l5raw
    // Filter dates
    .filterDate(start, end)
    // Filter area
    .filterBounds(subarea),
  asFloat: true
});

// Crop
var image_clip = image.clip(subarea);

// Parameters
var trueColor =  {bands: ['B3', 'B2', 'B1'], min: 0.1, max: 0.3}; 
var falseColor = {bands: ['B4', 'B3', 'B2'], min: 0.1, max: 0.3, gamma: 1};

// Add true image first
Map.addLayer(image_clip, falseColor, 'ORIGINAL_FALSECOLOR');

///////////////////////////////////////////////////////////////////////////
// TASSELED CAP CONVERSION

// Create an Array of Tasseled Cap coefficients.
var coefficients = ee.Array([
  [0.3037, 0.2793, 0.4743, 0.5585, 0.5082, 0.1863],
  [-0.2848, -0.2435, -0.5436, 0.7243, 0.0840, -0.1800],
  [0.1509, 0.1973, 0.3279, 0.3406, -0.7112, -0.4572],
  [-0.8242, 0.0849, 0.4392, -0.0580, 0.2012, -0.2768],
  [-0.3280, 0.0549, 0.1075, 0.1855, -0.4357, 0.8085],
  [0.1084, -0.9022, 0.4120, 0.0573, -0.0251, 0.0238]
]);

// Select the bands of interest.
var image2 = image_clip.select(['B1', 'B2', 'B3', 'B4', 'B5', 'B7']);

// Make an Array Image, with a 1-D Array per pixel.
var arrayImage1D = image2.toArray();

// Make an Array Image with a 2-D Array per pixel, 6x1.
var arrayImage2D = arrayImage1D.toArray(1);

var array1D = ee.Array([1, 2, 3]);              // [1,2,3]
var array2D = ee.Array.cat([array1D], 1);     // [[1],[2],[3]]

// Do a matrix multiplication: 6x6 times 6x1.
var image3 = ee.Image(coefficients)
  .matrixMultiply(arrayImage2D)
  // Get rid of the extra dimensions.
  .arrayProject([0])
  .arrayFlatten(
    [['brightness', 'greenness', 'wetness', 'fourth', 'fifth', 'sixth']]);

// Display the first three bands of the result and the input imagery.
var vizParams = {
  bands: ['brightness', 'greenness', 'wetness'],
  min: -0.1, max: [0.5, 0.1, 0.1]
};

// Print TC image to console
print(image3, 'TC components Image');

// Add layer with TC image
Map.addLayer(image3, vizParams, 'TC_IMAGE');

///////////////////////////////////////////////////////////////////////////
// CLASSIFICATION:

// Merge rectangles with examples per class
var trainingFeatures=aquaculture.merge(vegetation).merge(water);

// Select TC bands
var predictionBands=['brightness', 'greenness', 'wetness', 'fourth', 'fifth', 'sixth'];

// Sample to create training
var classifierTraining=image3.select(predictionBands) 
  .sampleRegions({collection:trainingFeatures, 
  properties:['class'], scale:30
});

// Use CART model
var classifier = ee.Classifier.cart().train({ 
  features:classifierTraining,
  classProperty:'class',
  inputProperties:predictionBands 
});
  
// Classify
var classified = image3.select(predictionBands).classify(classifier); 

// Add layer with classification
Map.addLayer(classified,{min:0,max:2,palette:['#811111','#B5E0EE', '#104B11']},'CLASSIFIED');

///////////////////////////////////////////////////////////////////////////
// ACCURACY ASSESMENT:

// Split into training and test set randomly
var trainingTesting=classifierTraining.randomColumn(); 
var trainingSet=trainingTesting
  .filter(ee.Filter.lessThan('random',0.6)); 
var testingSet=trainingTesting
  .filter(ee.Filter.greaterThanOrEquals('random',0.6));

// Train classifier
var trained=ee.Classifier.cart().train({
  features:trainingSet, classProperty:'class', 
  inputProperties:predictionBands
});
  
// Create confusion matrix of the test set
var confusionMatrix=ee.ConfusionMatrix(testingSet.classify(trained) 
  .errorMatrix({
  actual:'class',
  predicted:'classification' }));

// Print results:
print('Confusion matrix:',confusionMatrix); 
print('Overall Accuracy:',confusionMatrix.accuracy()); 
print('Producers Accuracy:',confusionMatrix.producersAccuracy()); 
print('Consumers Accuracy:',confusionMatrix.consumersAccuracy());

///////////////////////////////////////////////////////////////////////////
// MEASURE AREAS CLASSIFIED:

// Measure area of each region:
var get_area = function(image, type, subarea){
  
  var subset_class = image.eq(type);
  var areaImage = subset_class.multiply(ee.Image.pixelArea());
  
  var stats = areaImage.reduceRegion({
    reducer: ee.Reducer.sum(),
    geometry: subarea,
    maxPixels: 5e9,
    scale: 30
  });
  return(stats.get('classification'));
};


var area_aquaculture = get_area(classified, 0, subarea);
var area_water = get_area(classified, 1, subarea);
var area_vegetation = get_area(classified, 2,subarea);
print('Aquaculture area: ', area_aquaculture, ' square meters');
print('Water area: ', area_water, ' square meters');
print('Vegetation area: ', area_vegetation, ' square meters');

///////////////////////////////////////////////////////////////////////////
// STORE RESULTS AND CREATE LINE CHART WITH TIME SERIES

// Results stored in a DataTable using a JavaScript literal
var dataTable = {
  cols: [{id: 'year', label: 'Year', type: 'string'},
         {id: 'aquaculture', label: 'Aquaculture', type: 'number'},
         {id: 'water', label: 'Water', type: 'number'},
         {id: 'vegetation', label: 'Vegetation', type: 'number'}],
  rows: [{c: [{v: '1988-89'}, {v: 75.1755}, {v: 180.8791}, {v: 160.2236}]},
        {c: [{v: '1990-92'}, {v: 89.9578}, {v: 186.1951}, {v: 140.1254}]},
        {c: [{v: '1993-94'}, {v: 95.6086}, {v: 180.0376}, {v: 140.6321}]},
        {c: [{v: '1995-96'}, {v: 109.0178}, {v: 183.4328}, {v: 123.8277}]},
        {c: [{v: '1997-98'}, {v: 102.0049}, {v: 186.9231}, {v: 127.3503}]},
        {c: [{v: '1999-00'}, {v: 115.1895}, {v: 180.8832}, {v: 120.2056}]},
        {c: [{v: '2000-01'}, {v: 163.4292}, {v: 178.5058}, {v: 74.3433}]},
        {c: [{v: '2002-03'}, {v: 162.739}, {v: 181.5844}, {v: 71.9548}]},
        {c: [{v: '2004-05'}, {v: 174.9113}, {v: 174.9113}, {v: 63.3445}]},
        {c: [{v: '2006-07'}, {v: 193.876}, {v: 158.0095}, {v: 64.3928}]},
        {c: [{v: '2008-09'}, {v: 169.0672}, {v: 178.8109}, {v: 68.4002}]},
        {c: [{v: '2010-11'}, {v: 188.8282}, {v: 171.0545}, {v: 56.3957}]}]
};

// Define a dictionary of customization options
var options = {
  title: 'Time Series: Area per class',
  vAxis: {title: 'Area (m. square meters)'},
  hAxis: {title: 'Date'},
  colors: ['red', 'blue', 'green'],
  lineWidth: 4
};

// Make a LineChart from the table and the options.
var chart = new Chart(dataTable, 'LineChart', options);

// Print the chart to display it in the console.
print(chart);

///////////////////////////////////////////////////////////////////////////