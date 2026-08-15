// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'governorate_model.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_GovernorateModel _$GovernorateModelFromJson(Map<String, dynamic> json) =>
    _GovernorateModel(
      id: (json['id'] as num).toInt(),
      name: json['name'] as String,
      nameAr: json['nameAr'] as String,
      isActive: json['isActive'] as bool? ?? true,
    );

Map<String, dynamic> _$GovernorateModelToJson(_GovernorateModel instance) =>
    <String, dynamic>{
      'id': instance.id,
      'name': instance.name,
      'nameAr': instance.nameAr,
      'isActive': instance.isActive,
    };
