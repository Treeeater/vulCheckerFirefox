if !(ARGV.length == 1)
	p "[usage]: ARGV0: input result file"
	exit
end

fh = File.open(ARGV[0],"r")
siteURL = ""
Granularity = 3

class ClickInfo
	attr_accessor :site, :success, :clickNo, :O_rank, :minClicksNeeded, :fromIframe, :visible, :w, :h, :type, :x, :y, :stringSig, :score, :clickStrategyAndRank, :xPath, :outerHTML, :clickURL, :futile
	def initialize()
		@minClicksNeeded = 999
		@futile = false
	end
end

statRecords = Hash.new
clicks = Array.new
siteURL = ""
fh.each_line{|l|
	l.chomp!
	success = false
	futile = false
	ignore = true
	if (l.start_with? "Testing site:") 
		siteURL = l[14..-1]
		clicks = Hash.new
		statRecords[siteURL] = clicks
		next
	end
	if (l.start_with? "Succeeded:")
		success = true
		l = l[10..-1]
		ignore = false
	elsif (l.start_with? "Failed:")
		success = false
		l = l[7..-1]
		ignore = false
	end
	if (ignore) then next end
	if (l[-7..-1]=="futile,")
		futile = true 
	end
	if (siteURL == "") then next end
	clicks = l.split(';')
	clicks.each_index{|c_i|
		items = clicks[c_i].split(",")
		if (items.length == 1)
			#this means dup or futile, ignore
			next
		end
		xPath = items[-3]
		outerHTML = items[-2]
		url = items[-1]
		key = "#{url}#{xPath}#{outerHTML}#{c_i}"
		if (statRecords[siteURL][key] == nil) then statRecords[siteURL][key] = ClickInfo.new end
		statRecords[siteURL][key].w = (items[-8].to_i/Granularity).ceil
		statRecords[siteURL][key].h = (items[-7].to_i/Granularity).ceil
		statRecords[siteURL][key].type = items[-6]
		statRecords[siteURL][key].x = (items[-5].to_i/Granularity).floor
		statRecords[siteURL][key].y = (items[-4].to_i/Granularity).floor
		statRecords[siteURL][key].clickURL = url
		statRecords[siteURL][key].xPath = xPath
		statRecords[siteURL][key].outerHTML = outerHTML
		statRecords[siteURL][key].site = siteURL
		statRecords[siteURL][key].success = statRecords[siteURL][key].success || success
		statRecords[siteURL][key].clickNo = c_i+1
		statRecords[siteURL][key].O_rank = items[0]
		if (statRecords[siteURL][key].minClicksNeeded > clicks.length && success)
			statRecords[siteURL][key].minClicksNeeded = clicks.length
		end
		statRecords[siteURL][key].fromIframe = items[1]
		statRecords[siteURL][key].visible = items[2]
		statRecords[siteURL][key].stringSig = items[3].split("|")
		statRecords[siteURL][key].score = items[4]
		statRecords[siteURL][key].clickStrategyAndRank = Array.new
		if (items.length > 10) then statRecords[siteURL][key].clickStrategyAndRank[items[5].split("/")[0].to_i] = items[5].split("/")[1] end
		if (items.length > 11) then statRecords[siteURL][key].clickStrategyAndRank[items[6].split("/")[0].to_i] = items[6].split("/")[1] end
		if (items.length > 12) then statRecords[siteURL][key].clickStrategyAndRank[items[7].split("/")[0].to_i] = items[7].split("/")[1] end
		if (items.length > 13) then statRecords[siteURL][key].clickStrategyAndRank[items[8].split("/")[0].to_i] = items[8].split("/")[1] end
		if (c_i == clicks.length - 2)
			#last click could be futile, previous must not be.
			statRecords[siteURL][key].futile = futile
		end
	}
}

density1stSuc = Hash.new(0)
density1stFail = Hash.new(0)
density2ndSuc = Hash.new(0)
density2ndFail = Hash.new(0)

statRecords.each_key{|url|
	stored = Hash.new
	statRecords[url].each_value{|r|
		if (stored[[r.x,r.y,r.w,r.h,r.xPath]]) then next end 
		if (r.fromIframe == "true") then next end
		if (r.visible != "true") then next end
		if (r.w == "0" || r.h == "0") then next end
		if (r.stringSig[0]=="NA") then next end			#ignore widgets.
		if (r.clickNo == 1)
			if (r.success == true)
				for i in 0..r.w
					for j in 0..r.h
						density1stSuc[[r.x + i, r.y + j]] += 1
					end
				end
				stored[[r.x,r.y,r.w,r.h,r.xPath]] = true
			else
				for i in 0..r.w
					for j in 0..r.h
						density1stFail[[r.x + i, r.y + j]] += 1
					end
				end
				stored[[r.x,r.y,r.w,r.h,r.xPath]] = true
			end
		elsif (r.clickNo == 2)
			if (r.success == true)
				for i in 0..r.w
					for j in 0..r.h
						density2ndSuc[[r.x + i, r.y + j]] += 1
					end
				end
				stored[[r.x,r.y,r.w,r.h,r.xPath]] = true
			else
				for i in 0..r.w
					for j in 0..r.h
						density2ndFail[[r.x + i, r.y + j]] += 1
					end
				end
				stored[[r.x,r.y,r.w,r.h,r.xPath]] = true
			end			
		end
	}
}

# outputDensity1stSuc = "\\,"+Array(0..189).join(",") + "\n"
# outputDensity1stFail = "\\,"+Array(0..189).join(",") + "\n"
# outputDensity2ndSuc = "\\,"+Array(0..189).join(",") + "\n"
# outputDensity2ndFail = "\\,"+Array(0..189).join(",") + "\n"
outputDensity1stSuc = ""
outputDensity1stFail = ""
outputDensity2ndSuc = ""
outputDensity2ndFail = ""
=begin
maxDensity1stSuc = -1
maxDensity1stFail = -1
maxDensity2ndSuc = -1
maxDensity2ndFail = -1

for i in 0..192
	for j in 0..120
		if (maxDensity1stSuc < density1stSuc[[i,j]]) then maxDensity1stSuc = density1stSuc[[i,j]] end
		if (maxDensity1stFail < density1stFail[[i,j]]) then maxDensity1stFail = density1stFail[[i,j]] end
		if (maxDensity2ndSuc < density2ndSuc[[i,j]]) then maxDensity2ndSuc = density2ndSuc[[i,j]] end
		if (maxDensity2ndFail < density2ndFail[[i,j]]) then maxDensity2ndFail = density2ndFail[[i,j]] end
	end
end

p maxDensity1stSuc
p maxDensity1stFail
p maxDensity2ndSuc
p maxDensity2ndFail
=end
for j in 0..(1200/Granularity)
	temp1 = Array.new
	temp2 = Array.new
	temp3 = Array.new
	temp4 = Array.new
	# outputDensity1stSuc+="#{j},"
	# outputDensity1stFail+="#{j},"
	# outputDensity2ndSuc+="#{j},"
	# outputDensity2ndFail+="#{j},"
	for i in 0..(1920/Granularity)
		temp1.push((density1stSuc[[i,j]]).to_s)
		temp2.push((density1stFail[[i,j]]).to_s)
		temp3.push((density2ndSuc[[i,j]]).to_s)
		temp4.push((density2ndFail[[i,j]]).to_s)
	end
	outputDensity1stSuc += temp1.join(",") + "\n"
	outputDensity1stFail += temp2.join(",") + "\n"
	outputDensity2ndSuc += temp3.join(",") + "\n"
	outputDensity2ndFail += temp4.join(",") + "\n"
end

File.open("density1stSuc.csv","w"){|f| f.write(outputDensity1stSuc)}
File.open("density1stFail.csv","w"){|f| f.write(outputDensity1stFail)}
File.open("density2ndSuc.csv","w"){|f| f.write(outputDensity2ndSuc)}
File.open("density2ndFail.csv","w"){|f| f.write(outputDensity2ndFail)}
