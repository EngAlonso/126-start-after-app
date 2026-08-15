// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'user_model.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_UserModel _$UserModelFromJson(Map<String, dynamic> json) => _UserModel(
  id: (json['id'] as num).toInt(),
  fullName: json['fullName'] as String,
  mobile: json['mobile'] as String,
  email: json['email'] as String?,
  role: json['role'] as String,
  status: json['status'] as String,
  profileImage: json['profileImage'] as String?,
  jobTitle: json['jobTitle'] as String?,
  createdAt: json['createdAt'] as String?,
  suspensionReason: json['suspensionReason'] as String?,
  bannedUntil: json['bannedUntil'] as String?,
  isFounder: json['isFounder'] as bool? ?? false,
  technicianProfile: json['technicianProfile'] == null
      ? null
      : TechnicianProfileModel.fromJson(
          json['technicianProfile'] as Map<String, dynamic>,
        ),
);

Map<String, dynamic> _$UserModelToJson(_UserModel instance) =>
    <String, dynamic>{
      'id': instance.id,
      'fullName': instance.fullName,
      'mobile': instance.mobile,
      'email': instance.email,
      'role': instance.role,
      'status': instance.status,
      'profileImage': instance.profileImage,
      'jobTitle': instance.jobTitle,
      'createdAt': instance.createdAt,
      'suspensionReason': instance.suspensionReason,
      'bannedUntil': instance.bannedUntil,
      'isFounder': instance.isFounder,
      'technicianProfile': instance.technicianProfile,
    };
