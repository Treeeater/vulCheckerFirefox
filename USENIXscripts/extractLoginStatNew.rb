if !(ARGV.length == 3)
	p "[usage]: ARGV0: input result file, ARGV1: succeeded clicks output csv file, ARGV2: failed clicks output csv file"
	exit
end

fh = File.open(ARGV[0],"r")
siteURL = ""

class ClickInfo
	attr_accessor :site, :success, :clickNo, :O_rank, :minClicksNeeded, :fromIframe, :visible, :w, :h, :type, :x, :y, :stringSig, :score, :clickStrategyAndRank, :xPath, :outerHTML, :clickURL, :futile
	def initialize()
		@minClicksNeeded = 999
		@futile = false
	end
end

outputCSVSuccess = "Site,success,clickNo,O-rank,clicksNeeded,fromIframe,visible,w,h,type,x, y,FB,Facebook,OAuth,login,signin,connect,account,forum,Score,VSr,ISr,VRr,IRr,clickURL,outerHTML,XPath,futile\n"
outputCSVFailed = "Site,success,clickNo,O-rank,clicksNeeded,fromIframe,visible,w,h,type,x, y,FB,Facebook,OAuth,login,signin,connect,account,forum,Score,VSr,ISr,VRr,IRr,clickURL,outerHTML,XPath,futile\n"
outputErrorSites = Array.new
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
		key = "#{url}#{xPath}#{outerHTML}"
		if (statRecords[siteURL][key] == nil) then statRecords[siteURL][key] = ClickInfo.new end
		statRecords[siteURL][key].w = items[-8]
		statRecords[siteURL][key].h = items[-7]
		statRecords[siteURL][key].type = items[-6]
		statRecords[siteURL][key].x = items[-5]
		statRecords[siteURL][key].y = items[-4]
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

statRecords.each_key{|k|
	statRecords[k].each_value{|c|
		if (c.success)
			outputCSVSuccess += (k + ",")
			outputCSVSuccess += (c.success.to_s + ",")
			outputCSVSuccess += (c.clickNo.to_s + ",")
			outputCSVSuccess += (c.O_rank.to_s + ",")
			if (c.minClicksNeeded == 999) then c.minClicksNeeded = "NA" end
			outputCSVSuccess += (c.minClicksNeeded.to_s + ",")
			outputCSVSuccess += (c.fromIframe.to_s + ",")
			outputCSVSuccess += (c.visible.to_s + ",")
			outputCSVSuccess += (c.w.to_s + ",")
			outputCSVSuccess += (c.h.to_s + ",")
			outputCSVSuccess += (c.type.to_s + ",")
			outputCSVSuccess += (c.x.to_s + ",")
			outputCSVSuccess += (c.y.to_s + ",")
			outputCSVSuccess += (c.stringSig.join(",") + ",")
			outputCSVSuccess += (c.score + ",")
			for j in 0..3
				if (c.clickStrategyAndRank[j])
					outputCSVSuccess += (c.clickStrategyAndRank[j] + ",")
				else
					outputCSVSuccess += "NA,"
				end
			end
			outputCSVSuccess += (c.clickURL + ",")
			outputCSVSuccess += (c.xPath + ",")
			outputCSVSuccess += (c.outerHTML + ",")
			outputCSVSuccess += ("false")
			outputCSVSuccess += "\n"
		else
			outputCSVFailed += (k + ",")
			outputCSVFailed += (c.success.to_s + ",")
			outputCSVFailed += (c.clickNo.to_s + ",")
			outputCSVFailed += (c.O_rank.to_s + ",")
			if (c.minClicksNeeded == 999) then c.minClicksNeeded = "NA" end
			outputCSVFailed += (c.minClicksNeeded.to_s + ",")
			outputCSVFailed += (c.fromIframe.to_s + ",")
			outputCSVFailed += (c.visible.to_s + ",")
			outputCSVFailed += (c.w.to_s + ",")
			outputCSVFailed += (c.h.to_s + ",")
			outputCSVFailed += (c.type.to_s + ",")
			outputCSVFailed += (c.x.to_s + ",")
			outputCSVFailed += (c.y.to_s + ",")
			outputCSVFailed += (c.stringSig.join(",") + ",")
			outputCSVFailed += (c.score + ",")
			for j in 0..3
				if (c.clickStrategyAndRank[j])
					outputCSVFailed += (c.clickStrategyAndRank[j] + ",")
				else
					outputCSVFailed += "NA,"
				end
			end
			outputCSVFailed += (c.clickURL + ",")
			outputCSVFailed += (c.xPath + ",")
			outputCSVFailed += (c.outerHTML + ",")
			outputCSVFailed += (c.futile.to_s)
			outputCSVFailed += "\n"
		end
	}
}

File.open(ARGV[1],"w"){|f| f.write(outputCSVSuccess)}
File.open(ARGV[2],"w"){|f| f.write(outputCSVFailed)}

