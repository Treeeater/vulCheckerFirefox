var CONST = require('./const');

exports.debug = true;
exports.writeFlag = true;
exports.automatedTestingFlag = true;
exports.tryFindInvisibleLoginButton = false;
exports.registrationNeeded = false;
exports.searchForSignUpForFB = false;
exports.cleanResultDirectoryUponInit = true;
exports.webService = false;

exports.SubmitButtonClickDepth = 2;
exports.LoginButtonCandidateSize = 32;
exports.SubmitButtonCandidateSize = 2;

exports.USENIX = {experiments: {recordLoginButton: false, testRegistrationNeeded:false, exhaustiveSearchAndRecord:false, searchLoginButtonOnly:false}};

exports.detectionMode = CONST.dm.access_token_vul | CONST.dm.code_vul | CONST.dm.signed_request_vul | CONST.dm.referrer_vul | CONST.dm.secret_in_body_vul;
//auto generated below
//------------------

exports.LoginButtonClickDepth = 3;
exports.maxCandidatesAllowedEachStrategy = 10;
exports.oracleURL = false;
exports.tryUpperRightCorner = false;
exports.mustBeHostRelatedDomain = false;