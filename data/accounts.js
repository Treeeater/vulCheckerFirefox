var Account = function(fn,ln,email,pic,pic2){
	this.firstName = fn;
	this.lastName = ln;
	this.email = email;
	this.picSRC = pic;
	this.picSRC2 = pic2;
}

var accounts = [];

accounts.push(new Account("Yuchentest","Zhou","t-yuzhou@hotmail.com","https://fbcdn-profile-a.akamaihd.net/hprofile-ak-ash4/372678_100003929906137_108293698_q.jpg","https://profile-b.xx.fbcdn.net/hprofile-prn2/c21.21.259.259/s160x160/10468_169575083183487_845810054_n.jpg"));

accounts.push(new Account("Syxvq","Ldswpk","Syxvq_Ldswpk@yahoo.com","https://fbcdn-profile-a.akamaihd.net/hprofile-ak-prn2/s32x32/211884_100006061110883_1974931350_q.jpg","https://fbcdn-profile-a.akamaihd.net/hprofile-ak-frc3/c44.24.302.302/s160x160/971984_1374544449424246_1607036321_n.jpg"));