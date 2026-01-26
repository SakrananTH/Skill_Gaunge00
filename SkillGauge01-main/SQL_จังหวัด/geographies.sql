/*
Navicat MySQL Data Transfer

Source Server         : localhost
Source Server Version : 50505
Source Host           : localhost:3306
Source Database       : test

Target Server Type    : MYSQL
Target Server Version : 50505
File Encoding         : 65001

Date: 2022-12-28 13:30:12
*/

SET FOREIGN_KEY_CHECKS=0;

-- ----------------------------
-- Table structure for geographies
-- ----------------------------
DROP TABLE IF EXISTS `geographies`;
CREATE TABLE `geographies` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(255) COLLATE utf8_bin NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=MyISAM AUTO_INCREMENT=7 DEFAULT CHARSET=utf8 COLLATE=utf8_bin COMMENT='InnoDB free: 8192 kB';

-- ----------------------------
-- Records of geographies
-- ----------------------------
INSERT INTO `geographies` VALUES ('1', 'ภาคเหนือ');
INSERT INTO `geographies` VALUES ('2', 'ภาคกลาง');
INSERT INTO `geographies` VALUES ('3', 'ภาคตะวันออกเฉียงเหนือ');
INSERT INTO `geographies` VALUES ('4', 'ภาคตะวันตก');
INSERT INTO `geographies` VALUES ('5', 'ภาคตะวันออก');
INSERT INTO `geographies` VALUES ('6', 'ภาคใต้');
