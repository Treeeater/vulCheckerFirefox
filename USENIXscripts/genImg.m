function[] = drawHeat(fileName)
	a = csvread(fileName);
	a = a * 1000 / sum(sum(a));
	I = mat2gray(a, [0.0,1.0]);
	imshow(I);
end