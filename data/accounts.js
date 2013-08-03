var Account = function(fbid,fn,ln,email,pic,pic2,pic3,pic4,pass,token,sr,code){
	this.fbid = fbid;
	this.firstName = fn;
	this.lastName = ln;
	this.email = email;
	this.picSRC = pic;					//there are three pic srcs, and the site could use either.
	this.picSRC2 = pic2;
	this.picSRC3 = pic3;
	this.picSRC4 = pic4;
	this.passwd = pass;
	this.access_token = token;		//optional
	this.sr = sr;			//optional
	//this.code = code;			//optional
}

var accounts = [];


//Use all lower case please:
//no http protocol in picsrc please, because sites might use https.

//accounts.push(new Account("100003929906137","yuchentest","zhou","t-yuzhou@hotmail.com","372678_100003929906137_108293698_q.jpg","10468_169575083183487_845810054_n.jpg","graph.facebook.com/yuchentest.zhou/picture","graph.facebook.com/100003929906137/picture","msr123456"));
//accounts.push(new Account("100006061110883","syxvq","ldswpk","syxvq_ldswpk@yahoo.com","211884_100006061110883_1974931350_q.jpg","971984_1374544449424246_1607036321_n.jpg","graph.facebook.com/syxvq.ldswpk/picture","graph.facebook.com/100006061110883/picture","msr123456","CAADxRthhGccBADd8dWcTrIWSCpZCTDc8FZAxamQVYlRJQrrSQdMWBLDprfrSv0iThRUAJh39xvQFRIXrZCuoIh4y81IroouhRLpp2MZClxBvfHZBUZCe4r4NQGCaT9gaOzGkFtOTTWrXbZC296XfMMu"));

//accounts.push(new Account("chishi","wochishi","chishiwo@yahoo.com","372654_100006188405019_233762707_q.jpg","969187_1376813269201607_843083776_n.jpg","graph.facebook.com/chishi.wo/picture","graph.facebook.com/100006188405019/picture","msr123456"));

accounts.push(new Account("100006276816327","jiskamesda","quanarista","jiskamesdaquanarista@hotmail.com","369177_100006276816327_1668581066_q.jpg","1010344_1377140669171814_527772787_n.jpg","graph.facebook.com/jiskamesda.quanarista/picture","graph.facebook.com/100006276816327/picture","lasoei2lx","CAADxRthhGccBAGlaLKnX6UsSySGVL4DQgEvZAs4yBGSty17LI89zW9keEWah6JLHeZAMU6a1DbQ3jZCjDSQVyEuLhn9G0oN8vOGoRlSNv8QQaJSdcAAtpYC72MZBreZAmU49k7sI63qw7cTwHAlot","xR6dAO0pk5t9Qpl9oyPwDCzd5ihAVKubXEp_Dp0BgEE.eyJhbGdvcml0aG0iOiJITUFDLVNIQTI1NiIsImNvZGUiOiJBUUI3RXNzRjFIbjFoV254ZFluVUQxVUx4QXplMms2UGZzU2lPUHBhTHZDaEY0SHpzSXNQTnItV3U3Vkx4ck5sLXRYVHBMZHZoc05ZZU42NWNJaXlyc3d4Tnc2UVF6LU5xaXgzcFIwNmsyRmR6Q0x4V3ZhT1ZFdWItUkxRc1lwVWRTamczWWFjODN1ZG1EVHFLUWU3eDFtbmszWGdTQWdZTmVFeWd1cTgwdE1WRzdUMjc4NDl2Mnp6Q0xfeUhMTnNRdHZrX2t5VEYwNTROUF9tWE8wRnhQc09XbWRTYklNQm82dHp4NXhTT2NKQVZsNXpVSUtabjhLV08tV1gzQVJraVZ2WVBEN213dW9SQXE3SUJZY015cnBQTEVpaUlSQjRxb0FhWDB4eXBoSlJXeVhpVnBGbmVGeG9xNHBnRDBMdG10MlB1c1NHTDJJcVFUam5KVnhpVlFMOCIsImlzc3VlZF9hdCI6MTM3NTQ2MDczNSwidXNlcl9pZCI6IjEwMDAwNjI3NjgxNjMyNyJ9"));
accounts.push(new Account("100006154000685","oiaeai","cktstltauoai","oiaeaicktstltauoai@yahoo.com","211864_100006154000685_1779045138_q.jpg","1000284_1381272638754523_1690689043_n.jpg","graph.facebook.com/oiaeai.cktstltauoai/picture","graph.facebook.com/100006154000685/picture","msr123456","CAADxRthhGccBAFtpBpZAyg80NH6defOZCZAiRPAMCUmxlN3nw5ZBfQIK7YZAtKbCBYszbwZAsjLRbvP3CI2W0U0eXLaQhehZCEOu2LF7RzqxiVCGvTiAZCJ5ZCk5CxILfF2QKfSlsUXJ22y0dtJdA8MQO","FzeDxwOCkxb-8792AvtYKdxp9FewRErGtAKUJRJsp3I.eyJhbGdvcml0aG0iOiJITUFDLVNIQTI1NiIsImNvZGUiOiJBUUFoZ3BJbFBzTE9WVk14bDVob0RVQUQ1NEhKYXVpV0ppc3cwUlNwdUtCMTJ5R09iNG1SSmxpeHRJVHVRSVVzR0xoeGQ4dnQ3OGxDekdWazVRUkVkU2NwODNubWlkT2FYQkFLTC1tU3hiSmNIdlhQQzlBdDZOZHIzVzlTQXE4U3FnYUZPSDJVZVFmUUV5MHVOS2xpLTdXc3hDU0xxSk9HMHdSTndjWEM3eFcxcjVrOFFpc2QyVi1SQ1FsOW5laHNFUFU1Y2pldjZ0eUkyYk5pRlp6V1gwRXhOczlxRW1ISDBfUW1FbHVxMWNMTElGY0lvbjdmM3Npek1wOEFBT3RBZUFObW9haU5ONzNkdm5XTFR3SmE0V1lieThwV3BNWnNrczcyTkxPSHJhTm00Zi02WF9VenhGYjBQRGZpVUxFeENVSTQzREtOQjFsZ1dnenFwdmZVMkF0ciIsImlzc3VlZF9hdCI6MTM3NTQ2MDczMCwidXNlcl9pZCI6IjEwMDAwNjE1NDAwMDY4NSJ9"));



//Unused new accounts.

//accounts.push(new Account("100006266226539","chadadarnya","isackaldon","chadadarnyaisackaldon@outlook.com","623988_100006266226539_974898149_q.jpg","1010316_1377495322469329_736772771_n.jpg","graph.facebook.com/chadadarnya.isackaldon/picture","graph.facebook.com/100006266226539/picture","dis123456","CAADxRthhGccBADDZA3zXetqags5h3PznDCCeaTPAWy5XRbuRUYxZBgEw1E7cHZBNPWkBOq7fJZCsbiWJZBATXESxQSHPZCT8wQse6bKZBo1L0GaWZAwNUVWiq61CsLVR5GCgau9DVpJJ2cqiKOeBxPDtBuYNJor52z8ZD"));

//accounts.push(new Account("100006403802926","freachylet","dehoffman","dehoffmanf@hotmail.com","23184_100006403802926_209636439_q.jpg","72630_1376348132588634_1955838392_n.jpg","graph.facebook.com/freachylet.dehoffman/picture","graph.facebook.com/100006403802926/picture","namffohed","CAADxRthhGccBAEvFsHmZBl3uyI3TnZBpTS6k9ipMWNc3s1p5CZCSa52DOpYvMCEsKlqLyAaIU7AvzofVqPsI8WkhZAmx9bKsoDOQE2qZCDKEnu01IIxOj01z9gMxYNVgr7oTCij4qDwqhz1jfG3sG9ZCgZBf9oh4bUZD"));

//accounts.push(new Account("100006389916249","peatery","mcgerials","mcgerialsp@hotmail.com","573268_100006389916249_290949439_q.jpg","970121_1379358592287125_147233692_n.jpg","graph.facebook.com/peatery.mcgerials/picture","graph.facebook.com/100006389916249/picture","slairegcm","CAADxRthhGccBANi9kZCzMZC9Aj5a6vlRPsyO0r3ZC8yY9PmWN0AkS79fzjixw2AonxJAy4cZC1E4FDpf9op0M4Phd9Is4ZCfaUMZChbTJu5Xlf2RlGeuVGlrW9QaUzIEVmYSbFI5MiQitiZCgOz3ZB8LJ7FHEbsMChkZD"));

//accounts.push(new Account("100006342764606","clapsiur","rizorpus","rizorpusc@hotmail.com","1076182_100006342764606_1440236921_q.jpg","1000285_1391536071067805_1717201352_n.jpg","graph.facebook.com/clapsiur.rizorpus/picture","graph.facebook.com/100006342764606/picture","suprozir","CAADxRthhGccBAJhNhay2FGJHhS4Je1ZCKCy5dzid7e8Fsa0IthiL0rN2Hj0cqNpxVJGKPHZAerODQvnZA0wnZAVZCx9mHD5lOWGRBWgwSwQldrYExO5Xct1pxE4h3niZCt001ApZA3MDABc7yMp25pI"));