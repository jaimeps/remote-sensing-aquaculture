## Remote sensing: Tracking aquaculture in South Vietnam through Google Earth Engine

<p align="center">
	<img src="https://github.com/jaimeps/remote-sensing-aquaculture/blob/master/images/gee_logo.png" width="150">
</p>

### Description
This is a small project using [Google Earth Engine](https://developers.google.com/earth-engine/), a geospatial processing platform that combines a catalog of 30+ years of satellite images and Google's cloud-based computing power.

The goal of this project is to track the spread of shrimp farms in South Vietnam by analyzing and classifying satellite images from 1988 to 2011. 

### Region
The area chosen for this study is a rectangle in the province of Ca Mau.
<img src="https://github.com/jaimeps/remote-sensing-aquaculture/blob/master/images/ge_region.png" width="500">

### Image processing
I used images from the USGS Landsat 5 TM Raw Scenes (Orthorectified).
For each 2-year period:
- The collection of raw images is filtered by area and dates
- The simpleComposite algorithm obtains the images with the lowest cloud scores
- Clipping is used to reduce the image to our specific predefined rectangle

### Tasseled Cap conversion
Each image is converted to tasseled cap. The resulting image has 6 bands: brightness, greenness, wetness, fourth, fifth and sixth.

### Classification
The image can be decomposed into three major types of areas: water, vegetation and aquaculture. Samples of each type were selected according to the following map:
<p align="center">
	<img src="https://github.com/jaimeps/remote-sensing-aquaculture/blob/master/images/classification.png" width="500">
</p>
For each image, the samples were used to train the classifier. Subsequently a prediction was made for the entire image.
In regard to the classification algorithm, I found satisfactory results with a CART model.
A confusion matrix and a summary of different accuracy metrics are printed to the console.

### Area measurement
Once each pixel in the image is classified into one of the three types (water, vegetation and aquaculture), I measured the area (in square meters) covered by each type.

### Results
The following example (which corresponds to the period 2004-2005) summarizes the procedure: (1) the original image (in false color) after processing, (2) the image converted to tasseled cap, and (3) the classified image.
<img src="https://github.com/jaimeps/remote-sensing-aquaculture/blob/master/images/result.png">










