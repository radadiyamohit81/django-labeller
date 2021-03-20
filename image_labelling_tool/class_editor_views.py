import json
import re
from django.db import transaction
from django.http import JsonResponse, Http404
from django.shortcuts import render, redirect, get_object_or_404
from . import models


_INT_REGEX = re.compile(r'[\d]+')
_UUID_REGEX = re.compile(r'\b[0-9a-f]{8}\b-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-\b[0-9a-f]{12}\b')


def _reorder(models, src_model, idx_dst):
    ids = [model.id for model in models]
    idx_src = ids.index(src_model.id)
    if idx_src != idx_dst and idx_dst <= len(models):
        del models[idx_src]
        models.insert(idx_dst, src_model)
        for i, model in enumerate(models):
            model.order_index = i
            model.save()


def update_model_from_js(model, model_attr_name, value, save=False):
    if getattr(model, model_attr_name) != value:
        setattr(model, model_attr_name, value)
        return True
    else:
        return save or False

def update_label_classes(request):
    if request.method == 'POST':
        action = request.POST.get('action')
        params = json.loads(request.POST.get('params'))
        if action == 'group':
            group_id = params.get('group_id')
            active = params.get('active')
            human_name = params.get('human_name')
            if group_id is not None:
                try:
                    group_id = int(group_id)
                except ValueError:
                    pass
                else:
                    group = get_object_or_404(models.LabelClassGroup, id=group_id)
                    if active is not None:
                        group.active = active
                    if human_name is not None:
                        group.human_name = human_name
                    group.save()
            return JsonResponse({'status': 'success'})
        elif action == 'group_reorder':
            src_group_id = params.get('src_group_id')
            dst_index = params.get('dst_index')
            if src_group_id is not None and dst_index is not None:
                try:
                    src_group_id = int(src_group_id)
                    dst_index = int(dst_index)
                except ValueError:
                    pass
                else:
                    src_group = get_object_or_404(models.LabelClassGroup, id=src_group_id)
                    groups = list(models.LabelClassGroup.objects.order_by('order_index'))
                    _reorder(groups, src_group, dst_index)
            return JsonResponse({'status': 'success'})
        elif action == 'label_class':
            label_class_id = params.get('lcls_id')
            active = params.get('active')
            human_name = params.get('human_name')
            colour = params.get('colour')
            if label_class_id is not None:
                try:
                    label_class_id = int(label_class_id)
                except ValueError:
                    pass
                else:
                    label_class = get_object_or_404(models.LabelClass, id=label_class_id)
                    if active is not None:
                        label_class.active = active
                    if human_name is not None:
                        label_class.human_name = human_name
                    if colour is not None:
                        if colour['scheme'] == 'default':
                            label_class.default_colour = colour['colour']
                        else:
                            scheme_model = get_object_or_404(models.LabellingColourScheme, id_name=colour['scheme'])
                            label_colour = models.LabelClassColour.objects.get(
                                label_class=label_class, scheme=scheme_model)
                            if label_colour is None:
                                label_colour = models.LabelClassColour(
                                    label_class=label_class, scheme=scheme_model, colour=colour['colour'])
                                label_colour.save()
                            else:
                                label_colour.colour = colour['colour']
                            label_colour.save()
                    label_class.save()
            return JsonResponse({'status': 'success'})
        elif action == 'label_class_reorder':
            src_lcls_id = params.get('src_lcls_id')
            dst_index = params.get('dst_index')
            if src_lcls_id is not None and dst_index is not None:
                try:
                    src_lcls_id = int(src_lcls_id)
                    dst_index = int(dst_index)
                except ValueError:
                    pass
                else:
                    src_label_class = get_object_or_404(models.LabelClass, id=src_lcls_id)
                    dst_group = src_label_class.group
                    lcls_in_dst_group = list(dst_group.label_classes.order_by('order_index'))
                    _reorder(lcls_in_dst_group, src_label_class, dst_index)

            return JsonResponse({'status': 'success'})
        elif action == 'move_label_to_group':
            src_lcls_id = params.get('src_lcls_id')
            dst_group_id = params.get('dst_group_id')
            dst_index = params.get('dst_index')
            if src_lcls_id is not None and dst_group_id is not None:
                try:
                    src_lcls_id = int(src_lcls_id)
                    dst_group_id = int(dst_group_id)
                except ValueError:
                    pass
                else:
                    src_label_class = get_object_or_404(models.LabelClass, id=src_lcls_id)
                    dst_group = get_object_or_404(models.LabelClassGroup, id=dst_group_id)
                    lcls_in_dst_group = list(dst_group.label_classes.order_by('order_index'))

                    # Re-assign group
                    src_label_class.group = dst_group
                    lcls_in_dst_group.insert(dst_index, src_label_class)

                    for i, model in enumerate(lcls_in_dst_group):
                        model.order_index = i
                        model.save()

            return JsonResponse({'status': 'success'})
        elif action == 'update_colour_schemes':
            colour_schemes_js = params.get('colour_schemes')
            id_mapping = {}
            with transaction.atomic():
                for group_js in colour_schemes_js:
                    if isinstance(group_js['id'], str) and _UUID_REGEX.fullmatch(group_js['id']) is not None:
                        # New colour scheme
                        scheme_model = models.LabellingColourScheme(
                            id_name=group_js['name'], human_name=group_js['human_name'], active=group_js['active'])
                        scheme_model.save()
                        id_mapping[group_js['id']] = scheme_model.id
                    elif isinstance(group_js['id'], int):
                        scheme_model = models.LabellingColourScheme.objects.get(id=group_js['id'])
                        save = update_model_from_js(scheme_model, 'human_name', group_js['human_name'])
                        save = update_model_from_js(scheme_model, 'active', group_js['active'], save)
                        if save:
                            scheme_model.save()
            return JsonResponse({'status': 'success', 'id_mapping': id_mapping})
        elif action == 'update_label_class_groups':
            groups_js = params.get('groups')
            group_id_mapping = {}
            label_class_id_mapping = {}
            with transaction.atomic():
                for group_i, group_js in enumerate(groups_js):
                    if isinstance(group_js['id'], str) and _UUID_REGEX.fullmatch(group_js['id']) is not None:
                        # New colour scheme
                        group_model = models.LabelClassGroup(
                            human_name=group_js['group_name'], active=group_js['active'], order_index=group_i)
                        group_model.save()
                        group_id_mapping[group_js['id']] = group_model.id
                    elif isinstance(group_js['id'], int):
                        group_model = models.LabelClassGroup.objects.get(id=group_js['id'])
                        save = update_model_from_js(group_model, 'order_index', group_i)
                        save = update_model_from_js(group_model, 'human_name', group_js['group_name'], save)
                        save = update_model_from_js(group_model, 'active', group_js['active'], save)
                        if save:
                            group_model.save()
                    else:
                        raise ValueError

                    for lcls_i, lcls_js in enumerate(group_js['group_classes']):
                        if isinstance(lcls_js['id'], str) and _UUID_REGEX.fullmatch(lcls_js['id']) is not None:
                            # New colour scheme
                            lcls_model = models.LabelClass(
                                group=group_model, id_name=lcls_js['name'], active=lcls_js['active'], order_index=lcls_i,
                                human_name=lcls_js['human_name'], default_colour=lcls_js['colours']['default']['html'])
                            lcls_model.save()
                            label_class_id_mapping[lcls_js['id']] = lcls_model.id
                        elif isinstance(lcls_js['id'], int):
                            lcls_model = models.LabelClass.objects.get(id=lcls_js['id'])
                            save = update_model_from_js(lcls_model, 'order_index', lcls_i)
                            save = update_model_from_js(lcls_model, 'group', group_model, save)
                            save = update_model_from_js(lcls_model, 'active', lcls_js['active'], save)
                            save = update_model_from_js(lcls_model, 'human_name', lcls_js['human_name'], save)
                            save = update_model_from_js(lcls_model, 'default_colour', lcls_js['colours']['default']['html'], save)
                            if save:
                                lcls_model.save()
                        else:
                            raise ValueError

                        for col_scheme_name, col_js in lcls_js['colours'].items():
                            if col_scheme_name != 'default':
                                col_models = models.LabelClassColour.objects.filter(
                                    label_class=lcls_model, scheme__id_name=col_scheme_name)
                                if col_models.exists():
                                    col_model = col_models.first()
                                    save = update_model_from_js(col_model, 'colour', col_js['html'])
                                    if save:
                                        col_model.save()
                                else:
                                    scheme_models = models.LabellingColourScheme.objects.filter(id_name=col_scheme_name)
                                    if scheme_models.exists():
                                        col_model = models.LabelClassColour(
                                            label_class=lcls_model, scheme=scheme_models.first(), colour=col_js['html'])
                                    col_model.save()

            return JsonResponse({'status': 'success', 'group_id_mapping': group_id_mapping,
                                 'label_class_id_mapping': label_class_id_mapping})
    return JsonResponse({'status': 'failed'})


def handle_class_editor_forms(request):
    if request.method == 'POST':
        action = request.POST.get('action')
        if action == 'new_class_label':
            group_id = request.POST.get('group_id')
            name = request.POST.get('name')
            human_name = request.POST.get('human_name')

            try:
                group_id = int(group_id)
            except ValueError:
                raise Http404

            group = models.LabelClassGroup.objects.get(id=group_id)
            order_index = len(group.label_classes.all())
            lcls = models.LabelClass(group=group, id_name=name, human_name=human_name,
                                     order_index=order_index)
            lcls.save()
        elif action == 'new_label_class_group':
            human_name = request.POST.get('human_name')

            order_index = len(models.LabelClassGroup.objects.all())

            group = models.LabelClassGroup(human_name=human_name, order_index=order_index)
            group.save()
        elif action == 'new_colour_scheme':
            name = request.POST.get('name')
            human_name = request.POST.get('human_name')

            scheme = models.LabellingColourScheme(id_name=name, human_name=human_name, active=True)
            scheme.save()

