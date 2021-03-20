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

declare var Vue: any;
declare var vuedraggable: any;

module schema_editor {
    export class SchemaEditor {
        private update_url: string;

        constructor(update_url: string, colour_schemes_js: any[], groups_js: any[]) {
            let self = this;

            const RootComponent = {
                el: '#schema_editor',
                data() {
                    return {
                        schema: {
                            colour_schemes: colour_schemes_js,
                            groups: groups_js
                        }
                    }
                }
            };

            const app = Vue.createApp(RootComponent);

            app.component('draggable', vuedraggable);

            /*
            Colour scheme component
             */
            app.component('colour-schemes', {
                template: '#colour_schemes_template',
                props: {
                    schema: Object,
                },
                data: function() {
                    return {
                        'show_new_form': false,
                        'new_form_data': {
                            'name': '',
                            'human_name': ''
                        }
                    };
                },
                methods: {
                    on_new: function() {
                        this.show_new_form = true;
                    },
                    on_cancel_new: function() {
                        this.show_new_form = false;
                    },
                    on_create_new: function() {
                        if (this.new_form_data.name !== '') {
                            var scheme = {
                                active: true,
                                name: this.new_form_data.name,
                                human_name: this.new_form_data.human_name
                            };
                            for (let group of this.schema.groups) {
                                for (let lcls of group.group_classes) {
                                    lcls.colours[scheme.name] = {html: '#808080'};
                                }
                            }
                            this.schema.colour_schemes.push(scheme);
                        }
                        this.show_new_form = false;
                    }
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
                data: function() {
                    return {
                        'show_new_form': false,
                        'new_form_data': {
                            'group_name': '',
                        }
                    };
                },
                methods: {
                    on_new: function() {
                        this.show_new_form = true;
                    },
                    on_cancel_new: function() {
                        this.show_new_form = false;
                    },
                    on_create_new: function() {
                        if (this.new_form_data.name !== '') {
                            var new_group = {
                                id: null,
                                active: true,
                                group_name: this.new_form_data.group_name,
                                group_classes: [],
                            };
                            this.schema.groups.push(new_group);
                        }
                        this.show_new_form = false;
                    },
                },
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
                data: function() {
                    return {
                        'show_new_form': false,
                        'new_form_data': {
                            'name': '',
                            'human_name': ''
                        }
                    };
                },
                methods: {
                    on_new: function() {
                        this.show_new_form = true;
                    },
                    on_cancel_new: function() {
                        this.show_new_form = false;
                    },
                    on_create_new: function() {
                        if (this.new_form_data.name !== '') {
                            var colours = {};
                            for (let scheme of this.schema.colour_schemes) {
                                colours[scheme.name] = {html: '#808080'};
                            }
                            colours['default'] = {html: '#808080'};
                            var lcls = {
                                id: null,
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
            });

            /*
            Colour editor text entry
             */
            app.component('colour-editor', {
                template: '#colour_editor_template',
                props: {
                    modelValue: String,
                },
                emits: ['update:modelValue'],
                data: function() {
                    return {
                        'value': '',
                    };
                },
                methods: {
                    on_input(e) {
                        if (SchemaEditor.check_colour(e.target.value)) {
                            this.$emit('update:modelValue', e.target.value);
                        }
                    },
                    is_valid() {
                        return SchemaEditor.check_colour(this.value);
                    }
                },
                created: function() {
                    this.value = this.modelValue;
                }
            });

            /*
            Mount the app
             */
            const vm = app.mount('#schema_editor');
        }


        private static colour_regex = /#[A-Fa-f0-9]{6}/;

        private static check_colour(col: string): boolean {
            var match = SchemaEditor.colour_regex.exec(col);
            if (match !== null) {
                return match.toString() == col;
            }
            return false;
        }
    }

}

