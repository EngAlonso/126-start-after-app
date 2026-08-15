// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'service_model.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_ServiceModel _$ServiceModelFromJson(Map<String, dynamic> json) =>
    _ServiceModel(
      id: (json['id'] as num).toInt(),
      name: json['name'] as String,
      nameAr: json['nameAr'] as String,
      icon: json['icon'] as String?,
      image: json['image'] as String?,
      isActive: json['isActive'] as bool? ?? true,
      displayOrder: (json['displayOrder'] as num?)?.toInt() ?? 0,
    );

Map<String, dynamic> _$ServiceModelToJson(_ServiceModel instance) =>
    <String, dynamic>{
      'id': instance.id,
      'name': instance.name,
      'nameAr': instance.nameAr,
      'icon': instance.icon,
      'image': instance.image,
      'isActive': instance.isActive,
      'displayOrder': instance.displayOrder,
    };
