if !(ARGV.length == 2)
	p "[usage]: ARGV0: input result file, ARGV1: output csv file"
	exit
end

fh = File.open(ARGV[0],"r")
siteURL = ""

class ClickInfo
	attr_accessor :site, :success, :clickNo, :O_rank, :minClicksNeeded, :fromIframe, :visible, :stringSig, :score, :clickStrategyAndRank, :xPath, :outerHTML, :clickURL, :dup, :futile
	def initialize()
		@minClicksNeeded = 999
	end
end

outputCSV = "Site,success,clickNo,O-rank,clicksNeeded,fromIframe, visible,FB,Facebook,OAuth,login,signin,connect,account,forum,Score,VSr,ISr,VRr,IRr,clickURL,outerHTML,XPath,dup,visited\n"
outputErrorSites = Array.new
statRecords = Hash.new
clicks = Array.new
siteURL = ""
fh.each_line{|l|
	l.chomp!
	success = false
	dup = false
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
	if (l[-4..-1]=="dup,") then dup = true end
	if (l[-7..-1]=="futile,") then futile = true end
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
		statRecords[siteURL][key].clickURL = url
		statRecords[siteURL][key].xPath = xPath
		statRecords[siteURL][key].outerHTML = outerHTML
		statRecords[siteURL][key].site = siteURL
		statRecords[siteURL][key].success = statRecords[siteURL][key].success || success
		statRecords[siteURL][key].clickNo = c_i
		statRecords[siteURL][key].O_rank = items[0]
		if (statRecords[siteURL][key].minClicksNeeded > clicks.length && success)
			statRecords[siteURL][key].minClicksNeeded = clicks.length
		end
		statRecords[siteURL][key].fromIframe = items[1]
		statRecords[siteURL][key].visible = items[2]
		statRecords[siteURL][key].stringSig = items[3].split("|")
		statRecords[siteURL][key].score = items[4]
		statRecords[siteURL][key].clickStrategyAndRank = Array.new
		if (items.length > 8) then statRecords[siteURL][key].clickStrategyAndRank[items[5].split("/")[0].to_i] = items[5].split("/")[1] end
		if (items.length > 9) then statRecords[siteURL][key].clickStrategyAndRank[items[6].split("/")[0].to_i] = items[6].split("/")[1] end
		if (items.length > 10) then statRecords[siteURL][key].clickStrategyAndRank[items[7].split("/")[0].to_i] = items[7].split("/")[1] end
		if (items.length > 11) then statRecords[siteURL][key].clickStrategyAndRank[items[8].split("/")[0].to_i] = items[8].split("/")[1] end
		statRecords[siteURL][key].dup = dup
		statRecords[siteURL][key].futile = futile
	}
}

statRecords.each_key{|k|
	statRecords[k].each_value{|c|
		outputCSV += (k + ",")
		outputCSV += (c.success.to_s + ",")
		outputCSV += (c.clickNo.to_s + ",")
		outputCSV += (c.O_rank.to_s + ",")
		if (c.minClicksNeeded == 999) then c.minClicksNeeded = "NA" end
		outputCSV += (c.minClicksNeeded.to_s + ",")
		outputCSV += (c.fromIframe.to_s + ",")
		outputCSV += (c.visible.to_s + ",")
		outputCSV += (c.stringSig.join(",") + ",")
		outputCSV += (c.score + ",")
		for j in 0..3
			if (c.clickStrategyAndRank[j])
				outputCSV += (c.clickStrategyAndRank[j] + ",")
			else
				outputCSV += "NA,"
			end
		end
		outputCSV += (c.clickURL + ",")
		outputCSV += (c.xPath + ",")
		outputCSV += (c.outerHTML + ",")
		outputCSV += (c.dup.to_s + ",")
		outputCSV += (c.futile.to_s + ",")
		outputCSV += "\n"
	}
}

File.open(ARGV[1],"w"){|f| f.write(outputCSV)}

