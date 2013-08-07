var detectionMode = {};
detectionMode.access_token_vul = 0x01;
detectionMode.code_vul = 0x02;
detectionMode.signed_request_vul = 0x04;
detectionMode.referrer_vul = 0x08;
detectionMode.secret_in_body_vul = 0x10;
detectionMode.state_vul = 0x20;

exports.dm = detectionMode;
