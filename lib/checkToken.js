exports.checkToken = function(storageRecord)
{
	if (!storageRecord.facebookDialogOAuthResponse) return false;
	var res = storageRecord.facebookDialogOAuthResponse;
	return;
}