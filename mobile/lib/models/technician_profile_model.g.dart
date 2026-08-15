// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'technician_profile_model.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_TechnicianProfileModel _$TechnicianProfileModelFromJson(
  Map<String, dynamic> json,
) => _TechnicianProfileModel(
  id: (json['id'] as num).toInt(),
  userId: (json['userId'] as num).toInt(),
  status: json['status'] as String?,
  pointsBalance: (json['pointsBalance'] as num?)?.toInt(),
  reservedPoints: (json['reservedPoints'] as num?)?.toInt(),
  yearsOfExperience: (json['yearsOfExperience'] as num?)?.toInt(),
);

Map<String, dynamic> _$TechnicianProfileModelToJson(
  _TechnicianProfileModel instance,
) => <String, dynamic>{
  'id': instance.id,
  'userId': instance.userId,
  'status': instance.status,
  'pointsBalance': instance.pointsBalance,
  'reservedPoints': instance.reservedPoints,
  'yearsOfExperience': instance.yearsOfExperience,
};
