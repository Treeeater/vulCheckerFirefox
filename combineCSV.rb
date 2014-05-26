def setSiteToError(hash,siteURL)
	hash[siteURL][0] = 2
	hash[siteURL][1] = 2
	hash[siteURL][2] = 2
	hash[siteURL][3] = 2
	hash[siteURL][4] = 2
end

def seeIfSiteDoesNotSupportFB(hash,tempArray,siteURL)
	if (hash[siteURL][4] == "4" && tempArray[5].chomp != "4")
		#if previously considers there's no FB support but now we consider there is, then assigns this run's result to the new value.
		#if previously test stalled, then assigns this run's result to the new value.
		(hash[siteURL])[0] = tempArray[1]
		(hash[siteURL])[1] = tempArray[2]
		(hash[siteURL])[2] = tempArray[3]
		(hash[siteURL])[3] = tempArray[4]
		(hash[siteURL])[4] = tempArray[5].chomp
		return true
	end
	if (hash[siteURL][4] != "4" && tempArray[5].chomp == "4")
		#if previously considers there's no FB support but now we consider there is, then assigns this run's result to the new value.
		#if previously test stalled, then assigns this run's result to the new value.
		p "#{siteURL} detected to have no FB in the new run."
		#(hash[siteURL])[0] = tempArray[1]
		#(hash[siteURL])[1] = tempArray[2]
		#(hash[siteURL])[2] = tempArray[3]
		#(hash[siteURL])[3] = tempArray[4]
		#(hash[siteURL])[4] = tempArray[5].chomp
		return true
	end
	if (hash[siteURL][4] == "4" && tempArray[5].chomp == "4")
		#two runs show the same result, we remove this siteURL from database
		hash.delete(siteURL)
		p "removed #{siteURL} because no FB login"
		return true
	end
	if (tempArray[5].chomp == "4") then return true end				#we don't want the rest of the caller function to deal with this situation.
	return false
end

if (ARGV.length != 2)
	p "wrong number of arguments. needs 1"
	exit 
end

inputFileName1 = ARGV[0]
inputFileName2 = ARGV[1]
hash = Hash.new
appID = Hash.new
errorHash = Hash.new
text1 = File.open(inputFileName1).read
text2 = File.open(inputFileName2).read

text1.each_line do |line|
	if (line.start_with? "AppID") then next end			#skip CSV header
	tempArray = line.split(',')
	siteURL = tempArray[1]
	if (tempArray[0]!="unknown") then appID[siteURL] = tempArray[0] end
	if (hash[siteURL]==nil) then hash[siteURL] = Array.new end
	(hash[siteURL])[0] = tempArray[2]
	(hash[siteURL])[1] = tempArray[3]
	(hash[siteURL])[2] = tempArray[4]
	(hash[siteURL])[3] = tempArray[5]
	(hash[siteURL])[4] = tempArray[6].chomp
end

text2.each_line do |line|
	if (line.start_with? "AppID") then next end			#skip CSV header
	tempArray = line.split(',')
	siteURL = tempArray[1]
	if (!appID.has_key? siteURL) then appID[siteURL] = tempArray[0] end
	if (tempArray[2] == "" && tempArray[3] == "" && tempArray[4] == "" && tempArray[5] == "" && tempArray[6].chomp == "") then next end		#skip the stalled items.
	if (hash[siteURL]==nil) then hash[siteURL] = Array.new end
	if (hash[siteURL][0].to_i >= 10) then next end				#a value greater than 10 means we have manually inspected it and determined it's one of the un-automatable scnearios, so don't worry about it.
	if (hash[siteURL][0].to_i == 2) then next end				#a value equal to 2 means our tool has automatically decided there's an implementation error, so don't worry about it. Actually, it shouldn't be here if the test results are obtained using test cases from the previous iteration.
	if (seeIfSiteDoesNotSupportFB(hash,tempArray,siteURL)) then next end		#if any of the two has disagreement on whether the site supports FB, then handle it differently.
	#For value meaning, please refer to Readme.md
	if ((hash[siteURL])[3] != "" && (hash[siteURL])[3] != nil && tempArray[5] != "" && tempArray[5] != nil && (hash[siteURL])[3] != tempArray[5]) 
		#Disagreement here is fine, we probably didn't see that in one try. Mark it vulnerable
		#p siteURL + " changed to vulnerable on disagreement for 4"
		if (tempArray[5] == "2")
			p "previously determined state now changed to error state on #{siteURL}."
			setSiteToError(hash,siteURL)
			next
		end
		hash[siteURL][3] = -1
	end
	if ((hash[siteURL])[0] != "" && (hash[siteURL])[0] != nil && tempArray[2] != "" && tempArray[2] != nil && (hash[siteURL])[0] != tempArray[2])
		if (errorHash[siteURL] == nil) then errorHash[siteURL] = 0 end
		errorHash[siteURL] += 1
	end
	if ((hash[siteURL])[1] != "" && (hash[siteURL])[1] != nil && tempArray[3] != "" && tempArray[3] != nil && (hash[siteURL])[1] != tempArray[3]) 
		if (errorHash[siteURL] == nil) then errorHash[siteURL] = 0 end
		errorHash[siteURL] += 2
	end
	if ((hash[siteURL])[2] != "" && (hash[siteURL])[2] != nil && tempArray[4] != "" && tempArray[4] != nil && (hash[siteURL])[2] != tempArray[4]) 
		if (errorHash[siteURL] == nil) then errorHash[siteURL] = 0 end
		errorHash[siteURL] += 4
	end
	if ((hash[siteURL])[4] != "" && (hash[siteURL])[4] != nil && tempArray[6].chomp != "" && tempArray[6].chomp != nil && (hash[siteURL])[4] != tempArray[6].chomp) 
		#Disagreement here is fine, we probably didn't see that in one try. Mark it vulnerable
		#p siteURL + " changed to vulnerable on disagreement for 5"
		hash[siteURL][4] = -1
	end
	
	if ((hash[siteURL])[0] == "" || (hash[siteURL])[0] == nil) then (hash[siteURL])[0] = tempArray[2] end
	if ((hash[siteURL])[1] == "" || (hash[siteURL])[1] == nil) then (hash[siteURL])[1] = tempArray[3] end
	if ((hash[siteURL])[2] == "" || (hash[siteURL])[2] == nil) then (hash[siteURL])[2] = tempArray[4] end
	if ((hash[siteURL])[3] == "" || (hash[siteURL])[3] == nil) then (hash[siteURL])[3] = tempArray[5] end
	if ((hash[siteURL])[4] == "" || (hash[siteURL])[4] == nil) then (hash[siteURL])[4] = tempArray[6].chomp end
end

errorHash.each_key{|k|
	p k+" "+errorHash[k].to_s
	#erase the entry to let next test resolve it.
	if (errorHash[k] & 1 == 1) then	hash[k][0] = "" end
	if (errorHash[k] & 2 == 2) then	hash[k][1] = ""	end
	if (errorHash[k] & 4 == 4) then hash[k][2] = "" end
}

#output
outputText = "AppID,Site URL,token vul,secret vul,signed_request vul,referrer vul,DOM vul\n"
completedCases = 0
doesNotSupportFBCases = Array.new
manuallyDoesNotSupportFBCases = Array.new
failedCasesToTestNext = Array.new
allSitesCount = 0
fBCorrectCount = 0
fBErrorDetectedCount = 0
fBOracleFailedCount = 0
manuallyCount = 0
manuallyOurFaultCount = 0
manuallyError = 0
captcha = 0
linking = 0
verifyEmail = 0
prepopulate = 0
ssl = 0
oracle = 0
timeout = 0
input = 0
submit = 0
other = 0
hash.each_key{|k|
	if (hash[k][0].to_s!="" && hash[k][1].to_s!="" && hash[k][2].to_s!="" && hash[k][3].to_s!="" && hash[k][4].to_s!="") 
		if (hash[k][0].to_s == "4")
			doesNotSupportFBCases.push(k)
		elsif (hash[k][0].to_s == "14")
			manuallyDoesNotSupportFBCases.push(k)
		else
			completedCases+=1
		end
	else
		failedCasesToTestNext.push(k)
	end
	allSitesCount+=1
	if (hash[k][0].to_i.abs==1 && hash[k][1].to_i.abs==1 && hash[k][2].to_i.abs==1 && hash[k][3].to_i.abs==1 && hash[k][4].to_i.abs==1) 
		fBCorrectCount+=1
	elsif (hash[k][0].to_i==2 && hash[k][1].to_i==2 && hash[k][2].to_i==2 && hash[k][3].to_i==2 && hash[k][4].to_i==2) 
		fBErrorDetectedCount+=1
	elsif (hash[k][0].to_i==3 || hash[k][2].to_i==3) 
		fBOracleFailedCount+=1
	elsif (hash[k][0].to_i>=10) 
		if (hash[k][0].to_i==10) then manuallyError += 1 end
		if (hash[k][0].to_i==11) then captcha += 1 end
		if (hash[k][0].to_i==12) then linking += 1 end
		if (hash[k][0].to_i==13) then verifyEmail += 1 end
		if (hash[k][0].to_i==15) then prepopulate += 1 end
		if (hash[k][0].to_i==16) then ssl += 1 end
		manuallyCount+=1
		if (hash[k][0].to_i>=20)
			if (hash[k][0].to_i==20) then oracle += 1 end
			if (hash[k][0].to_i==21) then timeout += 1 end
			if (hash[k][0].to_i==22) then input += 1 end
			if (hash[k][0].to_i==23) then submit += 1 end
			if (hash[k][0].to_i==24) then other += 1 end
			manuallyOurFaultCount+=1
		end
	elsif (hash[k][0].to_s!="" && hash[k][1].to_s!="" && hash[k][2].to_s!="" && hash[k][3].to_s!="" && hash[k][4].to_s!="" && hash[k][4].to_s != "4")
		p k + " is in an error state in new results.csv"
	end
	
	outputText = outputText + (appID[k]==nil ? "unknown":appID[k]) + ',' + k + ',' + hash[k][0].to_s + ',' + hash[k][1].to_s + ',' + hash[k][2].to_s + ',' + hash[k][3].to_s + ',' + hash[k][4].to_s + "\n"
}
p manuallyCount
p "total cases: #{allSitesCount}"
p "total tests that does not have Facebook login (temporarily, just this run, needs to confirm in the next.): #{doesNotSupportFBCases.length}"
p "total tests that does not have Facebook login (manually confirmed): #{manuallyDoesNotSupportFBCases.length}"
p "total cases that support Facebook: #{allSitesCount - doesNotSupportFBCases.length - manuallyDoesNotSupportFBCases.length}"
p "------------------------"
p "total completed tests: #{completedCases}"
p "total failed tests (excluding completed and known failed): #{allSitesCount - completedCases - doesNotSupportFBCases.length - manuallyDoesNotSupportFBCases.length}"
p "total FB implementation error tests (detected by our tool): #{fBErrorDetectedCount}"
p "total error cases by manual analysis: #{manuallyError}."
p "------------------------"
p "total FB implementation correct tests: #{allSitesCount - doesNotSupportFBCases.length - manuallyDoesNotSupportFBCases.length - fBErrorDetectedCount - manuallyError}"
p "total FB implementation correct tests (detected by our tool): #{fBCorrectCount}"
p "total FB oracle failed tests (detected by our tool): #{fBOracleFailedCount}"
p "------------------------"
p "total 11-16 cases: #{captcha + linking + verifyEmail + prepopulate + ssl}"
p "total captcha required cases: #{captcha}"
p "total linking cases: #{linking}"
p "total verifying email cases: #{verifyEmail}"
p "total pre-populated fields error cases: #{prepopulate}"
p "total SSL iframe cases: #{ssl}"
p "------------------------"
p "total other manual inspection cases: #{oracle + timeout + input + submit + other}"
p "total oracle cases: #{oracle}"
p "total timeout cases: #{timeout}"
p "total input cases: #{input}"
p "total submit cases: #{submit}"
p "total other cases: #{other}"
File.open("Results_new.csv","w+"){|f|
	f.write(outputText)
}

outputText = "exports.testList = ["

failedCasesToTestNext.each do |site|
	outputText += "'#{site}',"
end

doesNotSupportFBCases.each do |site|
	outputText += "'#{site}',"
end

outputText = outputText[0..-2] + "];"
File.open("allFailedSites.js","w+"){|f|
	f.write(outputText)
}

