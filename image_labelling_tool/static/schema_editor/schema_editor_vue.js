/*
The MIT License (MIT)

Copyright (c) 2015 University of East Anglia, Norwich, UK

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.

Developed by Geoffrey French in collaboration with Dr. M. Fisher and
Dr. M. Mackiewicz.
 */
/// <reference path="../jquery.d.ts" />
/// <reference path="../labelling_tool/object_id_table.ts" />
var schema_editor;
(function (schema_editor) {
    var DelayedFunctionTimeout = /** @class */ (function () {
        function DelayedFunctionTimeout(fn) {
            this.timeout_id = null;
            this.enabled = true;
            this.fn = fn;
        }
        DelayedFunctionTimeout.prototype.enqueue = function (interval) {
            if (this.enabled) {
                var self_1 = this;
                if (this.timeout_id !== null) {
                    clearTimeout(this.timeout_id);
                    this.timeout_id = null;
                }
                this.timeout_id = setTimeout(function () {
                    self_1.fn();
                    self_1.timeout_id = null;
                }, interval);
            }
        };
        DelayedFunctionTimeout.prototype.enable = function () {
            this.enabled = true;
        };
        DelayedFunctionTimeout.prototype.disable = function () {
            this.enabled = false;
        };
        return DelayedFunctionTimeout;
    }());
    var SchemaEditor = /** @class */ (function () {
        function SchemaEditor(update_url, colour_schemes_js, groups_js) {
            this.col_scheme_updater = null;
            this.cls_group_updater = null;
            var self = this;
            this.update_url = update_url;
            var RootComponent = {
                el: '#schema_editor',
                data: function () {
                    return {
                        schema: {
                            colour_schemes: colour_schemes_js,
                            groups: groups_js
                        }
                    };
                },
                created: function () {
                    var root_app = this;
                    self.col_scheme_updater = new DelayedFunctionTimeout(function () {
                        var on_response = function (msg) {
                            if (msg.status === 'success') {
                                console.log('Colour scheme update successful');
                                var id_mapping = msg.id_mapping;
                                for (var _i = 0, _a = root_app.schema.colour_schemes; _i < _a.length; _i++) {
                                    var scheme = _a[_i];
                                    if (id_mapping[scheme.id] !== undefined) {
                                        console.log('Remapping colour scheme ID ' + scheme.id + ' to ' + id_mapping[scheme.id]);
                                        scheme.id = id_mapping[scheme.id];
                                    }
                                }
                            }
                        };
                        self.send_update('update_colour_schemes', { colour_schemes: root_app.schema.colour_schemes }, on_response);
                    });
                    self.cls_group_updater = new DelayedFunctionTimeout(function () {
                        var on_response = function (msg) {
                            if (msg.status === 'success') {
                                console.log('Label classes update successful');
                                var group_id_mapping = msg.group_id_mapping;
                                var label_class_id_mapping = msg.label_class_id_mapping;
                                for (var _i = 0, _a = root_app.schema.groups; _i < _a.length; _i++) {
                                    var group = _a[_i];
                                    if (group_id_mapping[group.id] !== undefined) {
                                        console.log('Remapping group ID ' + group.id + ' to ' + group_id_mapping[group.id]);
                                        group.id = group_id_mapping[group.id];
                                    }
                                    for (var _b = 0, _c = group.group_classes; _b < _c.length; _b++) {
                                        var lcls = _c[_b];
                                        if (label_class_id_mapping[lcls.id] !== undefined) {
                                            console.log('Remapping label class ID ' + lcls.id + ' to ' + label_class_id_mapping[lcls.id]);
                                            lcls.id = label_class_id_mapping[lcls.id];
                                        }
                                    }
                                }
                            }
                        };
                        self.send_update('update_label_class_groups', { groups: root_app.schema.groups }, on_response);
                    });
                }
            };
            var app = Vue.createApp(RootComponent);
            console.log(app);
            // Register draggable component so we can use it in the templates
            app.component('draggable', vuedraggable);
            // Update mixin
            app.mixin({
                methods: {
                    queue_send_colour_scheme_update: function () {
                        if (self.col_scheme_updater !== null) {
                            self.col_scheme_updater.enqueue(2000);
                        }
                    },
                    queue_send_label_class_groups_update: function () {
                        if (self.cls_group_updater !== null) {
                            self.cls_group_updater.enqueue(2000);
                        }
                    },
                }
            });
            /*
            Colour scheme component
             */
            app.component('colour-schemes', {
                template: '#colour_schemes_template',
                props: {
                    schema: Object,
                },
                data: function () {
                    return {
                        'show_new_form': false,
                        'new_form_data': {
                            'name': '',
                            'human_name': ''
                        }
                    };
                },
                methods: {
                    on_new: function () {
                        this.show_new_form = true;
                    },
                    on_cancel_new: function () {
                        this.show_new_form = false;
                    },
                    on_create_new: function () {
                        if (this.new_form_data.name !== '') {
                            var scheme = {
                                id: labelling_tool.ObjectIDTable.uuidv4(),
                                active: true,
                                name: this.new_form_data.name,
                                human_name: this.new_form_data.human_name
                            };
                            for (var _i = 0, _a = this.schema.groups; _i < _a.length; _i++) {
                                var group = _a[_i];
                                for (var _b = 0, _c = group.group_classes; _b < _c.length; _b++) {
                                    var lcls = _c[_b];
                                    lcls.colours[scheme.name] = { html: '#808080' };
                                }
                            }
                            this.schema.colour_schemes.push(scheme);
                        }
                        this.show_new_form = false;
                    },
                },
                created: function () {
                    var _this = this;
                    Vue.watch(this.schema.colour_schemes, function (x, prev_x) {
                        _this.queue_send_colour_scheme_update();
                    });
                }
            });
            /*
            All label classes component
             */
            app.component('all-label-classes', {
                template: '#all_label_classes_template',
                props: {
                    schema: Object,
                },
                data: function () {
                    return {
                        'show_new_form': false,
                        'new_form_data': {
                            'group_name': '',
                        }
                    };
                },
                methods: {
                    on_new: function () {
                        this.show_new_form = true;
                    },
                    on_cancel_new: function () {
                        this.show_new_form = false;
                    },
                    on_create_new: function () {
                        if (this.new_form_data.name !== '') {
                            var new_group = {
                                id: labelling_tool.ObjectIDTable.uuidv4(),
                                active: true,
                                group_name: this.new_form_data.group_name,
                                group_classes: [],
                            };
                            this.schema.groups.push(new_group);
                        }
                        this.show_new_form = false;
                    },
                },
                created: function () {
                    var _this = this;
                    Vue.watch(this.schema.groups, function (x, prev_x) {
                        _this.queue_send_label_class_groups_update();
                    });
                }
            });
            /*
            Label class group template
             */
            app.component('label-class-group', {
                template: '#label_class_group_template',
                props: {
                    group: Object,
                    schema: Object
                },
                data: function () {
                    return {
                        'show_new_form': false,
                        'new_form_data': {
                            'name': '',
                            'human_name': ''
                        }
                    };
                },
                methods: {
                    on_new: function () {
                        this.show_new_form = true;
                    },
                    on_cancel_new: function () {
                        this.show_new_form = false;
                    },
                    on_create_new: function () {
                        if (this.new_form_data.name !== '') {
                            var colours = {};
                            for (var _i = 0, _a = this.schema.colour_schemes; _i < _a.length; _i++) {
                                var scheme = _a[_i];
                                colours[scheme.name] = { html: '#808080' };
                            }
                            colours['default'] = { html: '#808080' };
                            var lcls = {
                                id: labelling_tool.ObjectIDTable.uuidv4(),
                                active: true,
                                name: this.new_form_data.name,
                                human_name: this.new_form_data.human_name,
                                colours: colours
                            };
                            this.group.group_classes.push(lcls);
                        }
                        this.show_new_form = false;
                    },
                },
                created: function () {
                    var _this = this;
                    Vue.watch(this.group, function (x, prev_x) {
                        _this.queue_send_label_class_groups_update();
                    });
                }
            });
            /*
            Colour editor text entry
             */
            app.component('colour-editor', {
                template: '#colour_editor_template',
                props: {
                    colour_table: Object,
                    scheme_name: String,
                },
                data: function () {
                    return {
                        text_value: '',
                        colour_value: ''
                    };
                },
                emits: ['update:modelValue'],
                methods: {
                    on_text_input: function (e) {
                        if (SchemaEditor.check_colour(e.target.value)) {
                            this.update(e.target.value);
                        }
                    },
                    on_colour_input: function (e) {
                        this.update(e.target.value);
                    },
                    update: function (colour) {
                        if (this.colour_table.hasOwnProperty(this.scheme_name)) {
                            this.colour_table[this.scheme_name].html = colour;
                        }
                        else {
                            this.colour_table[this.scheme_name] = { html: colour };
                        }
                        this.colour_value = colour;
                        this.text_value = colour;
                    }
                },
                computed: {
                    html_colour: function () {
                        if (this.colour_table.hasOwnProperty(this.scheme_name)) {
                            return this.colour_table[this.scheme_name].html;
                        }
                        else {
                            return '#808080';
                        }
                    },
                    is_text_valid: function () {
                        return SchemaEditor.check_colour(this.text_value);
                    }
                },
                created: function () {
                    this.text_value = this.html_colour;
                    this.colour_value = this.html_colour;
                }
            });
            /*
            Mount the app
             */
            var vm = app.mount('#schema_editor');
        }
        SchemaEditor.prototype.send_update = function (action, params, on_response) {
            var self = this;
            var post_data = {
                action: action,
                params: JSON.stringify(params)
            };
            $.ajax({
                type: 'POST',
                url: self.update_url,
                data: post_data,
                success: function (msg) {
                    if (on_response !== undefined && on_response !== null) {
                        on_response(msg);
                    }
                },
                dataType: 'json'
            });
        };
        SchemaEditor.check_colour = function (col) {
            var match = SchemaEditor.colour_regex.exec(col);
            if (match !== null) {
                return match.toString() == col;
            }
            return false;
        };
        SchemaEditor.colour_regex = /#[A-Fa-f0-9]{6}/;
        return SchemaEditor;
    }());
    schema_editor.SchemaEditor = SchemaEditor;
})(schema_editor || (schema_editor = {}));
//# sourceMappingURL=schema_editor_vue.js.map