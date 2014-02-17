function[] = drawHeat(fileName1, fileName2, fileName3, fileName4)
	figure;
	a = csvread(fileName1);
	%a = a * 1000 / sum(sum(a));
	I = mat2gray(a);
	subplot(2,2,1);
	imshow(I);
    title(fileName1);
	a = csvread(fileName2);
	%a = a * 1000 / sum(sum(a));
	I = mat2gray(a);
	subplot(2,2,2);
	imshow(I);
    title(fileName2);
	a = csvread(fileName3);
	%a = a * 1000 / sum(sum(a));
	I = mat2gray(a);
	subplot(2,2,3);
	imshow(I);
    title(fileName3);
	a = csvread(fileName4);
	%a = a * 1000 / sum(sum(a));
	I = mat2gray(a);
	subplot(2,2,4);
	imshow(I);
    title(fileName4);
end