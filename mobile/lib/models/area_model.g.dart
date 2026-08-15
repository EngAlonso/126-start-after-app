// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'area_model.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_AreaModel _$AreaModelFromJson(Map<String, dynamic> json) => _AreaModel(
  id: (json['id'] as num).toInt(),
  name: json['name'] as String,
  nameAr: json['nameAr'] as String,
  governorateId: (json['governorateId'] as num).toInt(),
  isActive: json['isActive'] as bool? ?? true,
);

Map<String, dynamic> _$AreaModelToJson(_AreaModel instance) =>
    <String, dynamic>{
      'id': instance.id,
      'name': instance.name,
      'nameAr': instance.nameAr,
      'governorateId': instance.governorateId,
      'isActive': instance.isActive,
    };
