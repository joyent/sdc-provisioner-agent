/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/*
 * Copyright (c) 2014, Joyent, Inc.
 */

var execFile = require('child_process').execFile;
var fakekeys = require('./fakekeys');
var libcommon = require('../../lib/common');
var Client = require('../../lib/task_agent/client');

exports.testZoneDataset = 'zones/' + exports.testZoneName;

exports.provisionRequest = function (vars) {
    vars = vars || {};
    var uuid = '2e4a24af-97a2-4cb1-a2a4-1edb209fb311';
    var defaults = {
        'image_uuid': '01b2c898-945f-11e1-a523-af1afbe22822',
        'do_not_inventory': true,
        'root_pw': 'therootpw',
        'owner_uuid': 'this-is-my-uuid',
        'uuid': uuid,
        'zonename': uuid,
        'ram_in_bytes': 128*1024*1024,
        'max_swap': 2*128*1024*1024,
        'nics':  [
            { ip: '10.88.88.75',
                nic: 'external',
                mac: '90:b8:d0:86:b2:8c',
                netmask: '255.255.255.0',
                vlan_id: 0,
                nic_tag: 'external',
                gateway: '10.88.88.2',
                interface: 'net0'
            }
        ]
    };

    var keys = Object.keys(defaults);
    for (var i = 0; i < keys.length; i++) {
        if (vars[keys[i]] === undefined) {
            vars[keys[i]] = defaults[keys[i]];
        }
    }

    return vars;
};

exports.destroyZone = libcommon.destroyZone;

exports.createClient = function (callback) {
    var client = new Client({
        use_system_config: true,
        attemptToReconnect: false, log: console
    });

    client.configureAMQP(function () {
        client.connect(function () {
            console.log('Connected!');
            client.getAgentHandle(
                'provisioner',
                client.uuid,
                function (handle) {
                    console.log('Got agent handle: ' + handle.clientId);
                    callback(handle);
                });
        });
    });
};

exports.zoneBootTime = function (zonename, callback) {
    execFile(
        '/usr/sbin/zlogin',
        [ zonename, '/usr/bin/kstat', '-p', 'unix:0:system_misc:boot_time' ],
        function (error, stdout, stderr) {
            if (error) {
                callback(new Error(stderr.toString()));
                return;
            }
            var kv = stdout.toString().split(/\s+/);
            console.dir(kv);
            callback(undefined, kv[1]);
            return;
        });
};

var zoneadmListFields = [
    'zoneid', 'zonename', 'state',
    'zonepath', 'uuid', 'brand', 'ip-type'
];

var zoneadmListFieldCount = zoneadmListFields.length;

exports.zoneadmList = function (callback) {
    function onZoneadmList(error, stdout, stderr) {
        if (error) {
            return callback(error);
        }
        console.log('Listed -->' + stdout);

        var zones = {};
        var lines = stdout.split('\n');
        var i = lines.length;
        var parts;

        while (i--) {
            if (!lines[i]) {
                continue;
            }
            parts = lines[i].split(':');

            var j = zoneadmListFieldCount;
            var zonename = parts[1];
            zones[zonename] = {};
            while (j--) {
                var field = zoneadmListFields[j];
                zones[zonename][field] = parts[j];
            }
        }
        return callback(undefined, zones);
    }

    execFile('/usr/sbin/zoneadm', ['list', '-pi'], onZoneadmList);
};

exports.prctl = function (zonename, resourceControlName, callback) {
    execFile(
        '/usr/bin/prctl',
        [
            '-P', '-t', 'privileged',
            '-n', resourceControlName,
            '-i', 'zone', zonename
        ],
        function (error, stdout, stderr) {
            var parts = stdout.toString().trim().split('\n');
            var zone = parts[parts.length -1].split(/\s+/);
            return callback(null, zone);
        });
};
